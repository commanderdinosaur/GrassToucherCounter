// Real sign-in + storage using Firebase (Auth + Firestore).
// The website (index.html) only talks to this small interface, so the login
// service can be swapped without touching the page.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut as fbSignOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, collection, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const configured = !!firebaseConfig && !/^PASTE/.test(firebaseConfig.apiKey || "PASTE");

let auth, db;
if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);          // keeps people signed in between visits (stored on the device)
  db = getFirestore(app);
}

function need() {
  if (!configured) { const e = new Error("not-configured"); e.code = "app/not-configured"; throw e; }
}
const slim = (u) => (u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null);

export default {
  configured,
  onAuth(cb) {
    if (!configured) { setTimeout(() => cb(null), 0); return () => {}; }
    return onAuthStateChanged(auth, (u) => cb(slim(u)), () => cb(null));
  },
  async signUpEmail(email, password) { need(); return slim((await createUserWithEmailAndPassword(auth, email, password)).user); },
  async signInEmail(email, password) { need(); return slim((await signInWithEmailAndPassword(auth, email, password)).user); },
  async signInGoogle() {
    need();
    const provider = new GoogleAuthProvider();
    try {
      return slim((await signInWithPopup(auth, provider)).user);
    } catch (e) {
      // Some phone browsers block popups: fall back to a full-page Google sign-in.
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth, provider);
        return null;
      }
      throw e;
    }
  },
  signOut() { need(); return fbSignOut(auth); },
  async getProfile(uid) { const s = await getDoc(doc(db, "users", uid)); return s.exists() ? s.data() : null; },
  setProfile(uid, p) { return setDoc(doc(db, "users", uid), p, { merge: true }); },
  subscribePhotos(uid, ok, bad) {
    return onSnapshot(collection(db, "users", uid, "photos"),
      (s) => ok(s.docs.map((d) => ({ id: d.id, ...d.data() }))), bad);
  },
  addPhoto(uid, p) { return setDoc(doc(db, "users", uid, "photos", String(p.t)), p); },
  deletePhoto(uid, id) { return deleteDoc(doc(db, "users", uid, "photos", id)); }
};
