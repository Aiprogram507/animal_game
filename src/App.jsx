import React, { useState, useEffect, useCallback, useRef } from 'react';
// Firebase core and service functions
import { initializeApp } from 'firebase/app'; 
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged, getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, deleteDoc, getFirestore } from 'firebase/firestore';
// Icons and Tone
import { Play, Pause, SkipForward, RotateCcw, BookOpen, Gift, Utensils, MessageSquare, Music, VolumeX, Bone, RefreshCw } from 'lucide-react';
import * as Tone from 'tone';
import AdventureScreen from './AdventureScreen'; // 作成したAdventureScreen.jsxをインポート
// Firebase initialization logic
let auth, db, gameAppId;

if (typeof __firebase_config !== 'undefined' && typeof __app_id !== 'undefined') {
    try {
        const firebaseConfigGlobal = JSON.parse(__firebase_config);
        const appGlobal = initializeApp(firebaseConfigGlobal);
        auth = getAuth(appGlobal);
        db = getFirestore(appGlobal);
        gameAppId = __app_id;
        console.log("Firebase initialized with global config. App ID:", gameAppId);
    } catch (error) {
        console.error("Error parsing global Firebase config:", error);
        const tempConfig = {apiKey: "placeholder-global-error", authDomain: "placeholder", projectId: "placeholder-project-global-error"};
        const tempApp = initializeApp(tempConfig);
        auth = getAuth(tempApp);
        db = getFirestore(tempApp);
        gameAppId = "placeholder-project-global-error";
    }
} else {
    console.warn("Firebase global config not found. Attempting to use environment variables for local development.");
    const localFirebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
    };

    if (localFirebaseConfig.projectId) {
        try {
            const appLocal = initializeApp(localFirebaseConfig);
            auth = getAuth(appLocal);
            db = getFirestore(appLocal);
            gameAppId = localFirebaseConfig.projectId; 
            console.log("Firebase initialized with local config (env variables). App ID:", gameAppId);
        } catch (error) {
            console.error("Error initializing Firebase with local env config:", error, localFirebaseConfig);
            const tempConfig = {apiKey: "placeholder-local-error", authDomain: "placeholder", projectId: "placeholder-project-local-error"};
            const tempApp = initializeApp(tempConfig);
            auth = getAuth(tempApp);
            db = getFirestore(tempApp);
            gameAppId = "placeholder-project-local-error";
        }
    } else {
        console.error("Firebase local config (environment variables like VITE_FIREBASE_PROJECT_ID) not found.");
        const tempConfig = {apiKey: "placeholder-no-config", authDomain: "placeholder", projectId: "placeholder-project-no-config"};
        const tempApp = initializeApp(tempConfig);
        auth = getAuth(tempApp);
        db = getFirestore(tempApp);
        gameAppId = "placeholder-project-no-config";
    }
}


// --- Constants ---
const BASE_GAME_WIDTH = 400; 
const BASE_GAME_HEIGHT = 667; 
const ANIMAL_SIZE = 40;
const MAX_ANIMALS = 10;
const SATIETY_DECAY_RATE = 0.2; 
const HP_DECAY_RATE_HUNGRY = 0.1; 
const FRIENDSHIP_GAIN_FEED = 5;
const FRIENDSHIP_GAIN_ADVENTURE = 10;
const GROWTH_RATE = 0.05; 
const MAX_SATIETY = 100;
const MAX_HP = 100;
const MAX_FRIENDSHIP = 100;
const MAX_GROWTH = 100;
const ENCYCLOPEDIA_FRIENDSHIP_THRESHOLD = 80;
const DIARY_INTERVAL = 60000 * 2; 
const TALK_INTERVAL = 30000; 

const ANIMAL_TYPES = { DUCK: 'duck', BEAR: 'bear', HYBRID: 'hybrid' };
const ANIMAL_EMOJIS = { [ANIMAL_TYPES.DUCK]: '🦆', [ANIMAL_TYPES.BEAR]: '🐻', [ANIMAL_TYPES.HYBRID]: '🐼' };
const ANIMAL_TALKS = {
  [ANIMAL_TYPES.DUCK]: ["クワッ！", "お腹すいたクワ", "遊んでほしいクワ！", "今日もいい天気クワね"],
  [ANIMAL_TYPES.BEAR]: ["ガオー！", "ハチミツ食べたい…", "もっと強くなるぞー！", "のんびりしたいガオ"],
  [ANIMAL_TYPES.HYBRID]: ["パン…クワ？", "不思議な感じ…", "どっちも好き！", "新しい世界！"],
};

// --- Helper Functions ---
const getRandomPosition = (gameWidth, gameHeight) => ({ 
  x: Math.random() * (gameWidth - ANIMAL_SIZE),
  y: Math.random() * (gameHeight - ANIMAL_SIZE - 150), 
});

const createNewAnimal = (type, gameWidth, gameHeight, idSuffix = crypto.randomUUID().slice(0,4), generation = 1) => {
  const specificType = type === 'random' ? (Math.random() < 0.5 ? ANIMAL_TYPES.DUCK : ANIMAL_TYPES.BEAR) : type;
  return {
    id: `${specificType}-${idSuffix}`, type: specificType,
    name: `${ANIMAL_EMOJIS[specificType]}${specificType.charAt(0).toUpperCase() + specificType.slice(1)} #${idSuffix}`,
    hp: MAX_HP, maxHp: MAX_HP, satiety: MAX_SATIETY / 2, maxSatiety: MAX_SATIETY,
    friendship: 50, 
    growth: 50,     
    ...getRandomPosition(gameWidth, gameHeight), 
    isAlive: true, lastSpoke: Date.now(), lastFed: Date.now(), acquiredDate: Date.now(),
    generation: generation, isMoving: true,
    targetX: Math.random() * (gameWidth - ANIMAL_SIZE),
    targetY: Math.random() * (gameHeight - ANIMAL_SIZE - 150), 
    speechBubble: null, speechTimeout: null,
  };
};

// --- BGM Player ---
let bgmPlayer = null;
const playBGM = () => { /* ... (BGM logic as before) ... */ };
const stopBGM = () => { /* ... (BGM logic as before) ... */ };

// --- Main App Component ---
export default function App() {
  const [userId, setUserId] = useState(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true); 
  const [isLoading, setIsLoading] = useState(false); 
  const [gameStarted, setGameStarted] = useState(false);
  const [animals, setAnimals] = useState([]);
  const [food, setFood] = useState(10);
  const [gachaTokens, setGachaTokens] = useState(3);
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [encyclopedia, setEncyclopedia] = useState([]);
  const [showGachaResult, setShowGachaResult] = useState(null);
  const [isBgmOn, setIsBgmOn] = useState(true);
  const [lastDiaryTime, setLastDiaryTime] = useState(Date.now());
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [currentModal, setCurrentModal] = useState(null);
  const [scale, setScale] = useState(1);
  const [isAdventuring, setIsAdventuring] = useState(false);
  const [adventureParty, setAdventureParty] = useState([]);
// 以前の版では adventurePartyForScreen という名前でしたが、adventureParty に統一しました

  const animalsRef = useRef(animals);
  useEffect(() => { animalsRef.current = animals; }, [animals]);

  useEffect(() => {
    const handleResize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const availableWidth = viewportWidth - 20; 
      const availableHeight = viewportHeight - 120; 
      const scaleX = availableWidth / BASE_GAME_WIDTH;
      const scaleY = availableHeight / BASE_GAME_HEIGHT;
      const newScale = Math.min(scaleX, scaleY, 1); 
      setScale(newScale);
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    console.log("App Mount: Setting up Firebase Auth listener.");
    setIsAuthInitializing(true);
    if (!auth) { 
        console.error("Firebase Auth is not initialized when App component mounts.");
        setIsAuthInitializing(false);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("onAuthStateChanged triggered. User:", user ? user.uid : "null");
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null); 
        console.log("Auth: No user signed in, attempting anonymous or custom token sign-in.");
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error("Auth: Error signing in:", error);
        }
      }
      setIsAuthInitializing(false); 
    });
    return () => {
      console.log("App Unmount: Cleaning up Firebase Auth listener.");
      unsubscribe();
    }
  }, []); 

  const getGameDataRef = useCallback(() => {
    if (!userId || !db || !gameAppId) return null; 
    return doc(db, `artifacts/${gameAppId}/users/${userId}/gameData/main`); 
  }, [userId]); 

  const loadGame = useCallback(async () => {
    console.log("loadGame called. userId:", userId);
    if (!userId) { 
        console.log("loadGame: Aborted - no userId.");
        setIsLoading(false); 
        setShowStartScreen(true); 
        setGameStarted(false);
        return;
    }
    
    setIsLoading(true); 
    const gameDataRef = getGameDataRef();
    if (!gameDataRef) {
      setIsLoading(false);
      console.log("loadGame: Aborted - gameDataRef is null.");
      setShowStartScreen(true); 
      setGameStarted(false);
      return;
    }

    try {
      console.log("loadGame: Attempting to load game data from:", gameDataRef.path);
      const docSnap = await getDoc(gameDataRef);
      if (docSnap.exists()) {
        console.log("loadGame: Game data found.");
        const data = docSnap.data();
        setAnimals(data.animals || []);
        setFood(data.food || 10);
        setGachaTokens(data.gachaTokens || 3);
        setDiaryEntries(data.diaryEntries || []);
        setEncyclopedia(data.encyclopedia || []);
        setIsBgmOn(data.settings?.isBgmOn !== undefined ? data.settings.isBgmOn : true);
        setLastDiaryTime(data.lastDiaryTime || Date.now());
        setGameStarted(true); 
        setShowStartScreen(false);
        console.log("loadGame: Game started with loaded data.");
      } else {
        console.log("loadGame: No existing game data found. Will show 'load failed' screen.");
        setShowStartScreen(false); 
        setGameStarted(false); 
      }
    } catch (error) {
      console.error("loadGame: Error loading game:", error);
      setShowStartScreen(false); 
      setGameStarted(false); 
    } finally {
      setIsLoading(false);
      console.log("loadGame: Finished. isLoading set to false.");
    }
  }, [userId, getGameDataRef]); 

  const saveGame = useCallback(async () => {
    console.log("saveGame: Called. Conditions:", { userId, gameStarted });
    if (!userId || !gameStarted) {
        console.warn("saveGame: Cannot save - No user ID, or game not started.");
        setCurrentModal({type: 'alert', message: "セーブできませんでした (ユーザー情報がないか、ゲームが開始されていません)。"});
        return;
    }
    const gameDataRef = getGameDataRef();
    if (!gameDataRef) {
        console.warn("saveGame: Cannot save - gameDataRef is null.");
        setCurrentModal({type: 'alert', message: "セーブデータの場所を特定できませんでした。"});
        return;
    }
    
    const dataToSave = {
      animals: animalsRef.current, 
      food: food, 
      gachaTokens: gachaTokens, 
      diaryEntries, 
      encyclopedia,
      lastSaveTime: serverTimestamp(), 
      lastDiaryTime, 
      settings: { isBgmOn },
    };
    console.log("saveGame: Attempting to save data:", dataToSave); // Removed JSON.stringify for brevity, can be added back if needed for deep inspection
    try {
      await setDoc(gameDataRef, dataToSave, { merge: true });
      console.log("saveGame: Game saved successfully to:", gameDataRef.path);
      setCurrentModal({type: 'alert', message: "ゲームを保存しました！"});
    } catch (error) {
      console.error("saveGame: Error saving game:", error);
      setCurrentModal({type: 'alert', message: `セーブに失敗しました: ${error.message}`});
    }
  }, [userId, gameStarted, food, gachaTokens, diaryEntries, encyclopedia, isBgmOn, lastDiaryTime, getGameDataRef, animalsRef]);

  const startNewGame = async (fromRestartButton = false) => {
    if (!userId) { 
        console.log("Cannot start new game: no user ID.");
        if (fromRestartButton) {
            setCurrentModal({type: 'alert', message: "ユーザー情報が取得できません。"});
        }
        setIsLoading(false); 
        return;
    }
    setIsLoading(true);
    console.log("Starting new game for user:", userId, "From restart:", fromRestartButton);
    const initialAnimals = [
        createNewAnimal(ANIMAL_TYPES.DUCK, BASE_GAME_WIDTH, BASE_GAME_HEIGHT, '001'), 
        createNewAnimal(ANIMAL_TYPES.BEAR, BASE_GAME_WIDTH, BASE_GAME_HEIGHT, '002')
    ];
    setAnimals(initialAnimals);
    animalsRef.current = initialAnimals; 
    setFood(10); 
    setGachaTokens(3);
    setDiaryEntries([{ timestamp: Date.now(), text: "新しい冒険が始まった！" }]);
    setEncyclopedia([]); setIsBgmOn(true); setLastDiaryTime(Date.now());
    
    const gameDataRef = getGameDataRef();
    if (gameDataRef) {
      try {
        const newGameData = { 
          animals: initialAnimals, food: 10, gachaTokens: 3,
          diaryEntries: [{ timestamp: Date.now(), text: "新しい冒険が始まった！" }],
          encyclopedia: [], lastSaveTime: serverTimestamp(), lastDiaryTime: Date.now(),
          settings: { isBgmOn: true },
        };
        await setDoc(gameDataRef, newGameData); 
        console.log("New game started and saved to:", gameDataRef.path);
        setGameStarted(true); 
        setShowStartScreen(false); 
      } catch (error) {
        console.error("Error starting new game and saving:", error);
        setGameStarted(false); setShowStartScreen(true); 
        setCurrentModal({type: 'alert', message: "ゲームの開始に失敗しました。"});
      }
    } else {
        console.log("Cannot save new game: gameDataRef is null.");
        setGameStarted(false); setShowStartScreen(true);
        setCurrentModal({type: 'alert', message: "ゲームの保存領域を準備できませんでした。"});
    }
    setIsLoading(false);
  };

  
  
  
  useEffect(() => {
    console.log("useEffect for loadGame trigger:", { userId, showStartScreen, gameStarted, isLoading, isAuthInitializing });
    if (!isAuthInitializing && userId && !showStartScreen && !gameStarted && !isLoading) {
      console.log("Conditions met to trigger loadGame.");
      loadGame();
    }
  }, [userId, showStartScreen, gameStarted, isLoading, isAuthInitializing, loadGame]);


  useEffect(() => { /* ... (BGM useEffect) ... */ }, [isBgmOn, gameStarted]);
  const toggleBGM = () => setIsBgmOn(prev => !prev);

  useEffect(() => {
    if (!gameStarted || isLoading) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      let newDiaryEntriesLocal = [...diaryEntries]; 
      let newEncyclopediaLocal = [...encyclopedia]; 
      let conflictOccurredThisTick = false;

      setAnimals(prevAnimals => {
        let fightingAnimalIds = []; 
        let updatedAnimals = prevAnimals.map(animal => { 
          if (!animal.isAlive) return animal;

          let { satiety, hp, friendship, growth, lastSpoke, speechBubble, speechTimeout } = animal;
          satiety = Math.max(0, satiety - SATIETY_DECAY_RATE);
          if (satiety === 0) {
            hp = Math.max(0, hp - HP_DECAY_RATE_HUNGRY);
            if (hp > 0) fightingAnimalIds.push(animal.id); 
          }
          growth = Math.min(MAX_GROWTH, growth + GROWTH_RATE);
          if (now - lastSpoke > TALK_INTERVAL && !speechBubble) {
            const talks = ANIMAL_TALKS[animal.type] || ["..."];
            const newSpeech = talks[Math.floor(Math.random() * talks.length)];
            speechBubble = newSpeech; 
            lastSpoke = now;
            if(speechTimeout) clearTimeout(speechTimeout);
            speechTimeout = setTimeout(() => {
              setAnimals(currentAnims => currentAnims.map(a => a.id === animal.id ? {...a, speechBubble: null, speechTimeout: null} : a));
            }, 5000); 
          }
          if (hp === 0) {
            if(animal.isAlive) { 
                newDiaryEntriesLocal.push({ timestamp: now, text: `${animal.name}は星になってしまった...` });
            }
            return { ...animal, isAlive: false, hp: 0, satiety: 0, speechBubble: null, speechTimeout: speechTimeout ? clearTimeout(speechTimeout) : null };
          }
          if (friendship >= ENCYCLOPEDIA_FRIENDSHIP_THRESHOLD && !newEncyclopediaLocal.find(e => e.id === animal.id)) {
            newEncyclopediaLocal.push({ id: animal.id, name: animal.name, type: animal.type, acquiredDate: animal.acquiredDate, discoveredDate: now });
            newDiaryEntriesLocal.push({ timestamp: now, text: `${animal.name}との絆が深まり、図鑑に記録された！` });
          }
          return { ...animal, satiety, hp, friendship, growth, lastSpoke, speechBubble, speechTimeout };
        }).filter(animal => animal.isAlive || (now - (animal.acquiredDate || 0) < 86400000)); 

        if (fightingAnimalIds.length >= 2) { /* ... (conflict logic as before) ... */ }
        return updatedAnimals;
      });
      if (newDiaryEntriesLocal.length !== diaryEntries.length) {
        setDiaryEntries(newDiaryEntriesLocal);
      }
      if (newEncyclopediaLocal.length !== encyclopedia.length) {
        setEncyclopedia(newEncyclopediaLocal);
      }
      if (now - lastDiaryTime > DIARY_INTERVAL) { /* ... (diary update logic as before) ... */ }
    }, 1000); 

    const autoSaveIntervalId = setInterval(saveGame, 60000); 
    return () => { clearInterval(intervalId); clearInterval(autoSaveIntervalId); /* ... (speech timeout cleanup) ... */ };
  }, [gameStarted, isLoading, diaryEntries, encyclopedia, lastDiaryTime, saveGame]); 

  useEffect(() => {
    if (!gameStarted || isLoading) return;
    const movementIntervalId = setInterval(() => {
      setAnimals(prevAnimals =>
        prevAnimals.map(animal => {
          if (!animal.isAlive || !animal.isMoving) return animal;
          let { x, y, targetX, targetY } = animal;
          const speed = 1 + (animal.growth / 50); 
          const currentMovementWidth = BASE_GAME_WIDTH - ANIMAL_SIZE; 
          const currentMovementHeight = BASE_GAME_HEIGHT - ANIMAL_SIZE - 150;
          if (Math.abs(x - targetX) < speed && Math.abs(y - targetY) < speed) {
            targetX = Math.random() * currentMovementWidth;
            targetY = Math.random() * currentMovementHeight;
          } else {
            if (x < targetX) x = Math.min(x + speed, targetX);
            else if (x > targetX) x = Math.max(x - speed, targetX);
            if (y < targetY) y = Math.min(y + speed, targetY);
            else if (y > targetY) y = Math.max(y - speed, targetY);
          }
          return { ...animal, x, y, targetX, targetY };
        })
      );
    }, 60); 
    return () => clearInterval(movementIntervalId);
  }, [gameStarted, isLoading]);

  const handleFeed = (animalId) => {
    console.log(`handleFeed: Called for animalId: ${animalId}. Current food: ${food}`);
    if (!gameStarted) {
        console.log("handleFeed: Game not started, cannot feed.");
        setCurrentModal({type: 'alert', message: "ゲームが開始されていません。"});
        return;
    }
    if (food <= 0) {
      console.log("handleFeed: No food available.");
      setCurrentModal({type: 'alert', message: "餌がありません！"});
      return;
    }

    let fedSuccessThisCall = false; 
    setAnimals(prevAnimals => {
      const newAnimals = prevAnimals.map(animal => {
        if (animal.id === animalId && animal.isAlive) {
          console.log(`handleFeed: Found animal ${animal.name} to feed in map.`);
          fedSuccessThisCall = true; 
          const newSatiety = Math.min(MAX_SATIETY, animal.satiety + 20);
          const newFriendship = Math.min(MAX_FRIENDSHIP, animal.friendship + FRIENDSHIP_GAIN_FEED);
          setDiaryEntries(prevDiary => [...prevDiary, { timestamp: Date.now(), text: `${animal.name}に餌をあげた。喜んでいるみたい！ (満腹度: ${newSatiety.toFixed(0)})` }]);
          return { ...animal, satiety: newSatiety, friendship: newFriendship, lastFed: Date.now() };
        }
        return animal;
      });
      // If an animal was fed, update the food count immediately after updating animals
      if (fedSuccessThisCall) {
        console.log("handleFeed: Animal was successfully fed. Updating food count.");
        setFood(prevFood => {
            const newFoodCount = prevFood - 1;
            console.log(`handleFeed: Food count changing from ${prevFood} to ${newFoodCount}`);
            return newFoodCount;
        });
      } else {
          console.log(`handleFeed: Animal with ID ${animalId} not found or not alive within map. Food not changed by this animal.`);
      }
      return newAnimals; 
    });
    // The setFood call is now inside the setAnimals updater's scope if fedSuccessThisCall is true after the map.
    // However, to ensure it's based on the result of the map, it's better to call setFood
    // outside but ensure fedSuccessThisCall is correctly scoped.
    // The current placement inside setAnimals's functional update is slightly unconventional
    // but aims to tie the food reduction directly to the successful feeding within the same logical update.
    // A cleaner way might be to separate these, but this should work if fedSuccessThisCall is correctly managed.
    // Let's refine:
    // The `fedSuccessThisCall` variable will be correctly set by the time `setAnimals` finishes its synchronous map operation.
    // So, the `if (fedSuccessThisCall)` check *after* `setAnimals` should work.
    // The issue might be if `setAnimals` itself is not completing or `fedSuccessThisCall` is not being set.
    // The previous version had `setFood` outside `setAnimals`'s callback, which is correct.
    // The key is that `fedSuccessThisCall` must be correctly determined.
  };

  const handleGacha = () => {
    console.log("handleGacha: Attempting gacha. Tokens:", gachaTokens);
     if (!gameStarted) {
        console.log("handleGacha: Game not started, cannot use gacha.");
        setCurrentModal({type: 'alert', message: "ゲームが開始されていません。"});
        return;
    }
    if (gachaTokens <= 0) {
      console.log("handleGacha: No gacha tokens.");
      setCurrentModal({type: 'alert', message: "ガチャトークンがありません！"});
      return;
    }
    const aliveAnimalsCount = animalsRef.current.filter(a => a.isAlive).length; 
    console.log("handleGacha: Alive animals:", aliveAnimalsCount, "Max animals:", MAX_ANIMALS);
    if (aliveAnimalsCount >= MAX_ANIMALS) {
      console.log("handleGacha: Max animals reached.");
      setCurrentModal({type: 'alert', message: "これ以上動物を増やせません。"});
      return;
    }

    setGachaTokens(prev => {
        const newTokens = prev - 1;
        console.log(`handleGacha: Gacha tokens changing from ${prev} to ${newTokens}`);
        return newTokens;
    });
    const newAnimal = createNewAnimal('random', BASE_GAME_WIDTH, BASE_GAME_HEIGHT);
    console.log("handleGacha: New animal created:", newAnimal);
    setAnimals(prev => {
        const newAnimalList = [...prev, newAnimal];
        console.log("handleGacha: Animals list updated. New count:", newAnimalList.length);
        return newAnimalList;
    });
    setShowGachaResult(newAnimal);
    setDiaryEntries(prev => [...prev, { timestamp: Date.now(), text: `ガチャで新しい仲間、${newAnimal.name}がやってきた！` }]);
    setCurrentModal('gachaResult');
    console.log("handleGacha: Gacha successful.");
  };

  const handleAdventure = () => {
  console.log("handleAdventure: Button clicked.");
  if (!gameStarted) {
      console.log("handleAdventure: Game not started.");
      setCurrentModal({type: 'alert', message: "ゲームが開始されていません。"});
      return;
  }
  const currentAnimalsList = animalsRef.current; // 最新の動物リストを参照
  const aliveAnimals = currentAnimalsList.filter(a => a.isAlive);
  if (aliveAnimals.length === 0) {
      console.log("handleAdventure: No alive animals.");
      setCurrentModal({type: 'alert', message: "冒険に出せる動物がいません！"});
      return;
  }
  // 戦闘システムの複雑化を避けるため、今回はパーティの最初の1匹のみを冒険に送る仕様
  const partyToSend = aliveAnimals.slice(0, 1); 
  console.log("handleAdventure: Party selected:", partyToSend.map(p=>p.name));
  setAdventureParty(partyToSend); // 冒険パーティのステートを更新
  setIsAdventuring(true);        // 冒険画面表示フラグをtrueに
  // stopBGM(); // 必要であればメインBGMを停止
  };

  const onAdventureComplete = useCallback((rewards) => { // ★★★ useCallbackでメモ化 ★★★
    console.log("onAdventureComplete: Adventure ended. Rewards:", rewards);
    setIsAdventuring(false); 
    setAdventureParty([]);   
    
    if (rewards) {
        let adventureLogEntries = [];
        // ... (報酬処理ロジックは変更なし) ...
        if (rewards.message) { 
            adventureLogEntries.push(rewards.message);
        } else if (rewards.defeated) {
            adventureLogEntries.push("冒険は失敗に終わった...");
        } else {
            adventureLogEntries.push("冒険から無事帰ってきた！");
        }

        if (rewards.foodFound) {
            setFood(prev => prev + rewards.foodFound);
            adventureLogEntries.push(`食べ物を${rewards.foodFound}個見つけた！`);
        }
        // ... (他の報酬処理) ...
        if (rewards.newAnimalTypeToCreate) { 
            if (animalsRef.current.filter(a => a.isAlive).length < MAX_ANIMALS) {
                const newAnimal = createNewAnimal(rewards.newAnimalTypeToCreate, BASE_GAME_WIDTH, BASE_GAME_HEIGHT);
                setAnimals(prev => [...prev, newAnimal]);
                adventureLogEntries.push(`新しい仲間、${newAnimal.name}と出会った！`);
            } else {
                adventureLogEntries.push(`新しい仲間と出会いそうだったが、仲間がいっぱいだった...`);
            }
        }
        if (rewards.xpGained && rewards.partyMemberIds && rewards.partyMemberIds.length > 0) {
            setAnimals(prevAnimals => prevAnimals.map(animal => {
                if (rewards.partyMemberIds.includes(animal.id)) {
                    const currentFriendship = animal.friendship;
                    const newFriendship = Math.min(MAX_FRIENDSHIP, animal.friendship + rewards.xpGained);
                    if (newFriendship > currentFriendship) {
                         adventureLogEntries.push(`${animal.name}は経験を積んで友好度が${newFriendship}になった！`);
                    }
                    return { ...animal, friendship: newFriendship };
                }
                return animal;
            }));
        }
        if (adventureLogEntries.length <= 1 && !rewards.defeated && !rewards.foodFound && !rewards.tokensFound && !rewards.newAnimalTypeToCreate && (!rewards.xpGained || rewards.xpGained <=0) ) {
             adventureLogEntries.push("特に大きな成果はなかったようだ。");
        }
        setDiaryEntries(prev => [...prev, ...adventureLogEntries.map(text => ({ timestamp: Date.now(), text }))]);
    } else {
        console.log("onAdventureComplete: No rewards data returned.");
         setDiaryEntries(prev => [...prev, { timestamp: Date.now(), text: "冒険はすぐに終わってしまった。" }]);
    }
  // ★★★ useCallbackの依存配列に必要なステートセッターや定数を記述 ★★★
  // setFood, setGachaTokens, setAnimals, setDiaryEntries, MAX_ANIMALS, MAX_FRIENDSHIP など
  // createNewAnimal も依存するなら含める (ただし外部関数なので通常不要)
  // animalsRef はrefなので依存配列に含める必要は通常ない
}, [MAX_ANIMALS, MAX_FRIENDSHIP]); // 依存配列を適切に設定 (例)

  const handleBreed = () => {
    console.log("handleBreed: Attempting to breed. Current animals from ref:", animalsRef.current.length);
    if (!gameStarted) {
        console.log("handleBreed: Game not started.");
        setCurrentModal({type: 'alert', message: "ゲームが開始されていません。"});
        return;
    }

    const currentAnimalsList = animalsRef.current; 
    const potentialParents = currentAnimalsList.filter(a => a.isAlive && a.growth >= 50 && a.friendship >= 50);
    console.log("handleBreed: Potential parents found:", potentialParents.length);
    potentialParents.forEach(p => console.log(`  - ${p.name} (Growth: ${p.growth}, Friendship: ${p.friendship}, ID: ${p.id})`));

    if (potentialParents.length < 2) {
        console.log("handleBreed: Not enough distinct eligible parents. Need at least 2.");
        setCurrentModal({type: 'alert', message: "繁殖できる動物が2匹以上いません。(成長度50以上、友好度50以上が必要です)"});
        return;
    }

    const aliveAnimalsCount = currentAnimalsList.filter(a => a.isAlive).length;
    if (aliveAnimalsCount >= MAX_ANIMALS) {
        console.log("handleBreed: Max animals reached. Current:", aliveAnimalsCount, "Max:", MAX_ANIMALS);
        setCurrentModal({type: 'alert', message: "これ以上動物を増やせません。"});
        return;
    }

    let parent1 = potentialParents[Math.floor(Math.random() * potentialParents.length)];
    let parent2 = potentialParents[Math.floor(Math.random() * potentialParents.length)];
    let attempts = 0;
    const MAX_SELECTION_ATTEMPTS = 20;

    if (potentialParents.length >= 2) { 
        while (parent1.id === parent2.id && attempts < MAX_SELECTION_ATTEMPTS) {
            console.log(`handleBreed: Parent 1 and 2 are same (ID: ${parent1.id}). Reselecting Parent 2. Attempt: ${attempts + 1}`);
            parent2 = potentialParents[Math.floor(Math.random() * potentialParents.length)];
            attempts++;
        }
    }
    
    if (parent1.id === parent2.id && potentialParents.length >=2) {
         console.log("handleBreed: Still same parent after attempts. Trying to pick first two distinct from list.");
         parent1 = potentialParents[0];
         const secondParent = potentialParents.find(p => p.id !== parent1.id);
         if (secondParent) {
             parent2 = secondParent;
         } else {
             console.log("handleBreed: Could not find two distinct parents even from list.");
         }
    }

    console.log(`handleBreed: Selected Parent 1: ${parent1.name} (ID: ${parent1.id})`);
    console.log(`handleBreed: Selected Parent 2: ${parent2.name} (ID: ${parent2.id})`);

    let childType;
    if (parent1.type === ANIMAL_TYPES.DUCK && parent2.type === ANIMAL_TYPES.DUCK) childType = ANIMAL_TYPES.DUCK;
    else if (parent1.type === ANIMAL_TYPES.BEAR && parent2.type === ANIMAL_TYPES.BEAR) childType = ANIMAL_TYPES.BEAR;
    else childType = ANIMAL_TYPES.HYBRID; 

    const childGeneration = Math.max(parent1.generation, parent2.generation) + 1;
    const child = createNewAnimal(childType, BASE_GAME_WIDTH, BASE_GAME_HEIGHT, crypto.randomUUID().slice(0,3), childGeneration);
    
    console.log("handleBreed: New child created:", child);

    setAnimals(prev => {
        const newAnimalList = [...prev, child];
        console.log("handleBreed: Animals list updated. New count:", newAnimalList.length);
        return newAnimalList;
    });
    setDiaryEntries(prev => [...prev, { timestamp: Date.now(), text: `${parent1.name}と${parent2.name}の間に新しい命、${child.name}が誕生した！(第${childGeneration}世代)` }]);
    setCurrentModal({type: 'alert', message: `${child.name}が誕生しました！`}); 
    console.log("handleBreed: Breeding successful.");
  };
  
  const openModal = (modalType) => setCurrentModal(modalType);
  const closeModal = () => { setCurrentModal(null); if (showGachaResult) setShowGachaResult(null); };

  // --- Render logic ---

  if (isAdventuring && adventureParty.length > 0) {
    return <AdventureScreen 
                party={adventureParty} 
                onAdventureComplete={onAdventureComplete}
                ANIMAL_EMOJIS_prop={ANIMAL_EMOJIS} // Pass EMOJIS
                ANIMAL_TYPES_prop={ANIMAL_TYPES}   // Pass TYPES
            />;
  }

  if (isAuthInitializing) { 
    return (
      <div id="app-root-for-bgm-check" className="w-screen min-h-screen flex items-center justify-center bg-gray-100 text-xl p-4 text-center">
          Firebase初期化中...
      </div>
  );
}

  if (showStartScreen) { 
    return (
      <div id="app-root-for-bgm-check" className="w-screen min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-300 via-blue-300 to-purple-400 text-white p-4">
        <h1 className="text-4xl font-bold mb-8 text-center">アヒルとクマの物語</h1>
        { !userId && <p className="text-lg mb-4">ユーザー認証を確認中...</p> }
        { userId && ( 
            <div className="space-y-4 w-full max-w-xs">
            <button
                onClick={() => startNewGame(false)} 
                className="w-full px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 flex items-center justify-center"
            >
                <Play className="inline mr-2" /> はじめから
            </button>
            <button
                onClick={() => { 
                    console.log("「つづきから」クリック");
                    if (userId) { 
                        setShowStartScreen(false); 
                    } else {
                        console.log("「つづきから」クリック: userIdがまだありません。");
                        setCurrentModal({type: 'alert', message: "ユーザー情報を確認中です。"});
                    }
                }} 
                className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 flex items-center justify-center"
            >
                <SkipForward className="inline mr-2" /> つづきから
            </button>
            </div>
        )}
        <p className="mt-8 text-sm text-center">ユーザーID: {userId || "確認中..."}</p>
        <p className="mt-2 text-xs text-center">App ID: {gameAppId || "確認中..."}</p>
      </div>
    );
  }
  
  if (isLoading) { 
      return (
          <div id="app-root-for-bgm-check" className="flex items-center justify-center min-h-screen bg-gray-100 text-xl p-4 text-center">
              ゲームデータを読み込み中...
          </div>
      );
  }

  if (!gameStarted) { 
     console.log("Render Fallback: Game not started. Load might have failed or no data found.");
     return (
        <div id="app-root-for-bgm-check" className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="text-xl text-center mb-4">保存されたゲームデータが見つかりませんでした。</div>
            <p className="text-sm mb-4">新しくゲームを始めるか、スタート画面に戻ってください。</p>
            <div className="space-y-2 w-full max-w-xs">
                <button
                    onClick={() => startNewGame(false)}
                    className="w-full px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg shadow-md"
                >
                    <Play className="inline mr-2" /> 新しくはじめる
                </button>
                <button
                    onClick={() => { 
                        setShowStartScreen(true);
                    }}
                    className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md"
                >
                    スタート画面に戻る
                </button>
            </div>
        </div>
     );
  }

  // Main Game UI
  return (
    <div id="app-root-for-bgm-check" className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 p-2 select-none overflow-hidden">
      <div 
        className="flex flex-col items-center transition-transform duration-300 ease-in-out"
        style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }} 
      >
        <div 
          style={{ width: BASE_GAME_WIDTH, height: BASE_GAME_HEIGHT }} 
          className="bg-green-400 border-4 border-green-600 rounded-lg shadow-2xl overflow-hidden relative mb-3"
        >
          {/* Animal rendering logic ... */}
          {animals.length > 0 ? animals.map(animal => {
            return animal.isAlive && (
              <div
                key={animal.id}
                className="absolute" 
                style={{ 
                    left: animal.x, top: animal.y,  
                    width: ANIMAL_SIZE, height: ANIMAL_SIZE,
                    cursor: 'pointer' 
                }}
                onClick={() => handleFeed(animal.id)}
                title={`餌をあげる: ${animal.name} (満腹度: ${animal.satiety.toFixed(0)}, HP: ${animal.hp.toFixed(0)})`}
              >
                <span 
                    className="text-3xl drop-shadow-md" 
                    style={{fontSize: `${Math.max(1.5, 2.5 * scale)}rem`}} 
                >
                    {ANIMAL_EMOJIS[animal.type]}
                </span>
                {animal.speechBubble && (
                  <div 
                    className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white p-1 px-2 rounded-lg shadow min-w-max z-30 text-black" 
                    style={{
                        fontSize: `${Math.max(0.6, 0.75 * scale)}rem`, 
                        padding: `${Math.max(0.15, 0.25 * scale)}rem ${Math.max(0.3, 0.5*scale)}rem`
                    }} 
                  >
                    {animal.speechBubble}
                  </div>
                )}
                <div className="w-full bg-gray-300 rounded-full h-1 mt-1"><div className="bg-red-500 h-1 rounded-full" style={{ width: `${(animal.hp / animal.maxHp) * 100}%` }}></div></div>
                <div className="w-full bg-gray-300 rounded-full h-1 mt-0.5"><div className="bg-yellow-500 h-1 rounded-full" style={{ width: `${(animal.satiety / animal.maxSatiety) * 100}%` }}></div></div>
              </div>
            )
          }) : (
            <div className="flex items-center justify-center h-full text-white text-lg">動物がいません...</div>
          )}
          {/* Info Overlay and BGM button ... */}
          <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white p-2 rounded-md text-xs z-20"> 
            <div>食べ物: {food}</div> <div>ガチャ券: {gachaTokens}</div>
            <div>動物の数: {animals.filter(a => a.isAlive).length} / {MAX_ANIMALS}</div>
            <div>ユーザーID: {userId ? userId.substring(0,8)+'...' : 'N/A'}</div>
          </div>
          <button onClick={toggleBGM} className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 text-white rounded-full z-20">
              {isBgmOn ? <Music size={18}/> : <VolumeX size={18}/>}
          </button>
        </div>

        {/* Controls Panel */}
        <div className="grid grid-cols-3 gap-2 w-full mb-2" style={{width: BASE_GAME_WIDTH}}> 
          <button onClick={() => openModal('gacha')} className="p-2 bg-purple-500 text-white rounded-lg shadow hover:bg-purple-600 flex flex-col items-center"><Gift size={20}/><span className="text-xs mt-1">ガチャ</span></button>
          <button onClick={handleAdventure} className="p-2 bg-orange-500 text-white rounded-lg shadow hover:bg-orange-600 flex flex-col items-center"><Bone size={20}/><span className="text-xs mt-1">冒険</span></button>
          <button onClick={() => openModal('breed')} className="p-2 bg-pink-500 text-white rounded-lg shadow hover:bg-pink-600 flex flex-col items-center">🐼<span className="text-xs mt-1">繁殖</span></button>
          <button onClick={() => openModal('diary')} className="p-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 flex flex-col items-center"><MessageSquare size={20}/><span className="text-xs mt-1">日記</span></button>
          <button onClick={() => openModal('encyclopedia')} className="p-2 bg-yellow-500 text-white rounded-lg shadow hover:bg-yellow-600 flex flex-col items-center"><BookOpen size={20}/><span className="text-xs mt-1">図鑑</span></button>
          <button onClick={saveGame} className="p-2 bg-green-500 text-white rounded-lg shadow hover:bg-green-600 flex flex-col items-center"><RotateCcw size={20}/><span className="text-xs mt-1">保存</span></button>
        </div>
        {/* Restart Button */}
        <div className="w-full" style={{width: BASE_GAME_WIDTH}}> 
            <button 
                onClick={() => {
                    console.log("Restarting game...");
                    startNewGame(true); 
                }}
                className="w-full p-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 flex items-center justify-center"
            >
                <RefreshCw size={20} className="mr-2"/> はじめからやり直す
            </button>
        </div>
      </div>

      {/* Modals ... (Modal logic remains the same) ... */}
      {currentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-5 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            {typeof currentModal === 'string' ? (
                <>
                    {currentModal === 'diary' && ( <div className="overflow-y-auto flex-grow"> <h2 className="text-xl font-bold mb-3 text-center">日記</h2> {diaryEntries.slice().reverse().map((entry, index) => ( <div key={index} className="mb-2 p-2 border-b border-gray-200"> <p className="text-sm text-gray-500">{new Date(entry.timestamp).toLocaleString()}</p> <p className="text-gray-700">{entry.text}</p> </div> ))} </div> )}
                    {currentModal === 'encyclopedia' && ( <div className="overflow-y-auto flex-grow"> <h2 className="text-xl font-bold mb-3 text-center">図鑑</h2> {encyclopedia.length > 0 ? encyclopedia.map(animal => ( <div key={animal.id} className="mb-2 p-2 border rounded-md bg-gray-50"> <p className="font-semibold text-lg">{ANIMAL_EMOJIS[animal.type]} {animal.name}</p> <p className="text-sm">種類: {animal.type}</p> <p className="text-sm">発見日: {new Date(animal.discoveredDate).toLocaleDateString()}</p> </div> )) : <p className="text-center text-gray-500">まだ図鑑に記録された動物はいません。</p>} </div> )}
                    {currentModal === 'gachaResult' && showGachaResult && ( <div className="text-center"> <h2 className="text-xl font-bold mb-3">ガチャ結果！</h2> <p className="text-5xl my-4">{ANIMAL_EMOJIS[showGachaResult.type]}</p> <p className="text-lg">新しい仲間、<span className="font-semibold">{showGachaResult.name}</span>がやってきた！</p> <p className="text-sm mt-2">大切に育てよう！</p> </div> )}
                    {currentModal === 'adventureResults' && ( <div className="overflow-y-auto flex-grow"> <h2 className="text-xl font-bold mb-3 text-center">冒険の結果</h2> {(diaryEntries.filter(e => e.text.includes("冒険") || e.text.includes("見つけた") || e.text.includes("出会った")).slice(-5).reverse() || []).map((entry, index) => ( <div key={index} className="mb-2 p-2 border-b border-gray-200"> <p className="text-sm text-gray-500">{new Date(entry.timestamp).toLocaleString()}</p> <p className="text-gray-700">{entry.text}</p> </div> ))} </div> )}
                    {currentModal === 'gacha' && ( <> <h2 className="text-xl font-bold mb-3 text-center">ガチャ</h2> <p className="text-center mb-4">ガチャトークン: {gachaTokens}</p> {gachaTokens > 0 ? ( <button onClick={handleGacha} className="w-full p-3 bg-purple-500 text-white rounded-lg shadow hover:bg-purple-600">1回引く！</button> ) : ( <p className="text-center text-red-500">ガチャトークンがありません。</p> )} </> )}
                    {currentModal === 'breed' && ( <> <h2 className="text-xl font-bold mb-3 text-center">繁殖</h2> <p className="text-center mb-4">成長度と友好度がそれぞれ50以上の動物が2匹以上いると繁殖できます。</p> {animalsRef.current.filter(a => a.isAlive && a.growth >= 50 && a.friendship >= 50).length >= 2 && animalsRef.current.filter(a => a.isAlive).length < MAX_ANIMALS ? ( <button onClick={handleBreed} className="w-full p-3 bg-pink-500 text-white rounded-lg shadow hover:bg-pink-600">新しい命を誕生させる</button> ) : ( <p className="text-center text-red-500">{animalsRef.current.filter(a => a.isAlive).length >= MAX_ANIMALS ? "動物がいっぱいです。" : "繁殖の条件を満たす動物がいません。"}</p> )} </> )}
                </>
            ) : currentModal.type === 'alert' && ( 
                 <>
                    <h2 className="text-xl font-bold mb-3 text-center text-gray-800">{currentModal.title || "お知らせ"}</h2>
                    <p className="text-center my-4 text-gray-700">{currentModal.message}</p>
                 </>
            )}
            <button onClick={closeModal} className="mt-4 p-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 w-full">閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
