import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase コンソールからコピーしたあなたのウェブアプリの Firebase 設定
const firebaseConfig = {
    apiKey: "AIzaSyAqeS3I-54ZzL-c9X0XQ8oncTfoco9JKUU",
    authDomain: "animalrpgreact.firebaseapp.com",
    projectId: "animalrpgreact",
    storageBucket: "animalrpgreact.firebasestorage.app",
    messagingSenderId: "318523797404",
    appId: "1:318523797404:web:1ab8f267e8087d84f2e259",
    measurementId: "G-8TSEM65GV4"
};

// Firebase を初期化
const app = initializeApp(firebaseConfig);

// Firebase の各サービスを取得してエクスポート
const auth = getAuth(app);
const db = getFirestore(app);

    // ゲームコード内で __app_id として参照されている部分のため、
    // projectId または appId をエクスポートするか、ゲームコード側を修正します。
    // ここでは projectId を使う例を示します。
    // Firestore のパスやルールで使用する ID と一致させてください。
const gameAppId = firebaseConfig.projectId; // または固定の文字列

export { app, auth, db, gameAppId };