// src/AdventureScreen.jsx

import React, { useState, useEffect } from 'react';

// 敵の定義（仮）
const ENEMIES = [
    { name: "森のスライム", hp: 30, maxHp: 30, attack: 5, defense: 2, reward: { food: 1, xp: 5 }, appearance: "🦠" },
    { name: "洞窟コウモリ", hp: 20, maxHp: 20, attack: 7, defense: 1, reward: { food: 0, tokens: 1, xp: 3 }, appearance: "🦇" },
    { name: "迷いの森オオカミ", hp: 60, maxHp: 60, attack: 10, defense: 4, reward: { food: 3, xp: 12, animalChance: 0.1, animalType: 'random' }, appearance: "🐺" },
];

// アニメーションのプレースホルダー（仮）
const AnimationDisplay = ({ text, isVisible }) => {
    if (!isVisible) return null;
    return <div className="text-center text-yellow-400 my-2 p-2 border border-yellow-500 rounded bg-black bg-opacity-30 animate-pulse">{text}</div>;
};


export default function AdventureScreen({ party, onAdventureComplete, ANIMAL_EMOJIS_prop, ANIMAL_TYPES_prop }) {
    const [enemy, setEnemy] = useState(null);
    const [playerCharacter, setPlayerCharacter] = useState(null); 
    const [playerCurrentHP, setPlayerCurrentHP] = useState(0);
    const [enemyCurrentHP, setEnemyCurrentHP] = useState(0);
    const [battleLog, setBattleLog] = useState([]);
    const [isPlayerTurn, setIsPlayerTurn] = useState(true);
    const [battleResult, setBattleResult] = useState(null); 
    const [isAnimating, setIsAnimating] = useState(false); 
    const [displayedRewards, setDisplayedRewards] = useState(null); // ★★★ 不足していたステート宣言を追加 ★★★

    useEffect(() => {
        if (party && party.length > 0) {
            const selectedCharacter = party[0]; 
            setPlayerCharacter(selectedCharacter);
            setPlayerCurrentHP(selectedCharacter.hp);

            const randomEnemyTemplate = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
            const currentEnemy = { ...randomEnemyTemplate }; 
            setEnemy(currentEnemy);
            setEnemyCurrentHP(currentEnemy.hp);

            setBattleLog([`[${selectedCharacter.name}] は冒険の途中で [${currentEnemy.name}] ${currentEnemy.appearance} に遭遇した！`]);
            setIsPlayerTurn(true);
            setBattleResult(null);
            setIsAnimating(false);
            setDisplayedRewards(null); 
        } else {
            console.error("AdventureScreen: Party is empty or undefined.");
            onAdventureComplete({ message: "冒険に出る仲間がいませんでした。" }); 
        }
    }, [party, onAdventureComplete]); 

    const addLog = (message) => {
        setBattleLog(prev => [message, ...prev.slice(0, 3)]); 
    };

    const simulateAnimation = (duration = 700) => {
        setIsAnimating(true);
        return new Promise(resolve => {
            setTimeout(() => {
                setIsAnimating(false);
                resolve();
            }, duration);
        });
    };

    const handlePlayerAttack = async () => {
        if (!isPlayerTurn || battleResult || !enemy || !playerCharacter || isAnimating) return;

        setIsAnimating(true); 
        addLog(`[${playerCharacter.name}] の攻撃！`);
        await simulateAnimation(700); 

        const playerAttackPower = 5 + Math.floor(playerCharacter.growth / 15) + Math.floor(playerCharacter.friendship / 25);
        const damageDealt = Math.max(1, playerAttackPower - (enemy.defense || 0));
        
        addLog(`[${enemy.name}] に ${damageDealt} のダメージ！`);
        const newEnemyHP = Math.max(0, enemyCurrentHP - damageDealt);
        setEnemyCurrentHP(newEnemyHP);

        if (newEnemyHP <= 0) {
            addLog(`[${enemy.name}] を倒した！`);
            setBattleResult('victory');
            await simulateAnimation(1000); 
        } else {
            setIsPlayerTurn(false); 
        }
        setIsAnimating(false); 
    };
    
    useEffect(() => {
        const enemyAttack = async () => {
            if (!isPlayerTurn && !battleResult && enemy && playerCharacter && playerCurrentHP > 0 && !isAnimating) {
                setIsAnimating(true); 
                addLog(`[${enemy.name}] ${enemy.appearance} の攻撃！`);
                await simulateAnimation(700); 

                const damageTaken = Math.max(1, enemy.attack - (Math.floor(playerCharacter.growth / 20) || 0)); 
                addLog(`[${playerCharacter.name}] は ${damageTaken} のダメージを受けた！`);
                
                const newPlayerHP = Math.max(0, playerCurrentHP - damageTaken);
                setPlayerCurrentHP(newPlayerHP);

                if (newPlayerHP <= 0) {
                    addLog(`[${playerCharacter.name}] は倒れてしまった...`);
                    setBattleResult('defeat');
                    await simulateAnimation(1000); 
                } else {
                    setIsPlayerTurn(true); 
                }
                setIsAnimating(false); 
            }
        };

        if (!isPlayerTurn && !battleResult && !isAnimating) { 
             enemyAttack();
        }
    }, [isPlayerTurn, battleResult, enemy, playerCharacter, playerCurrentHP, isAnimating]); 

    useEffect(() => {
        if (battleResult && !isAnimating && !displayedRewards) { 
            console.log(`AdventureScreen: Battle ended with ${battleResult}. Calculating rewards.`);
            let calculatedRewards = {
                partyMemberIds: party.map(p => p.id),
                xpGained: 0,
                foodFound: 0,
                tokensFound: 0,
                newAnimalTypeToCreate: null, 
                message: "", 
                defeated: battleResult === 'defeat'
            };
    
            if (battleResult === 'victory' && enemy) {
                calculatedRewards.xpGained = enemy.reward.xp || 0;
                calculatedRewards.foodFound = enemy.reward.food || 0;
                calculatedRewards.tokensFound = enemy.reward.tokens || 0;
                calculatedRewards.message = `[${enemy.name}] に勝利した！`;
                if (enemy.reward.animalChance && Math.random() < enemy.reward.animalChance) {
                    calculatedRewards.newAnimalTypeToCreate = enemy.reward.animalType === 'random' 
                        ? (Math.random() < 0.5 ? ANIMAL_TYPES_prop.DUCK : ANIMAL_TYPES_prop.BEAR) 
                        : enemy.reward.animalType;
                }
            } else if (battleResult === 'defeat') {
                calculatedRewards.message = enemy ? `[${enemy.name}] に敗北した...` : "戦いに敗れた...";
                calculatedRewards.xpGained = Math.floor((enemy?.reward?.xp || 5) / 3); 
            }
            setDisplayedRewards(calculatedRewards);
            console.log("AdventureScreen: Rewards calculated and set for display:", calculatedRewards);
        }
    }, [battleResult, isAnimating, party, enemy, ANIMAL_TYPES_prop, displayedRewards, ANIMAL_EMOJIS_prop]); // ANIMAL_EMOJIS_prop was missing from deps, added

    if (!enemy || !playerCharacter) {
        return <div className="w-full h-full flex items-center justify-center bg-black text-white p-4 text-center">冒険の準備をしています...</div>;
    }

    const playerEmoji = ANIMAL_EMOJIS_prop[playerCharacter.type] || "❓";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex flex-col items-center justify-center p-4 z-[60] text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="w-full max-w-sm p-4 border-2 border-gray-600 rounded-lg bg-gray-800 shadow-xl">
                <h2 className="text-2xl font-bold mb-6 text-center text-yellow-400 tracking-wider">戦闘開始！</h2>

                {/* Enemy Display */}
                <div className="mb-6 text-center">
                    <span className="text-5xl">{enemy.appearance}</span>
                    <p className="text-lg font-semibold text-red-400">{enemy.name}</p>
                    <p>HP: <span className={enemyCurrentHP <= enemy.maxHp / 4 ? "text-red-600 font-bold" : "text-red-300"}>{Math.round(enemyCurrentHP)}</span> / {enemy.maxHp}</p>
                    <div className="w-full bg-gray-700 rounded h-3 mt-1 shadow-inner"><div className="bg-red-500 h-full rounded" style={{ width: `${(enemyCurrentHP / enemy.maxHp) * 100}%` }}></div></div>
                </div>

                {/* Player Display */}
                 <div className="mb-6 text-center">
                     <span className="text-5xl">{playerEmoji}</span>
                    <p className="text-lg font-semibold text-blue-400">{playerCharacter.name}</p>
                    <p>HP: <span className={playerCurrentHP <= playerCharacter.hp / 4 ? "text-red-600 font-bold" : "text-blue-300"}>{Math.round(playerCurrentHP)}</span> / {Math.round(playerCharacter.hp)}</p>
                    <div className="w-full bg-gray-700 rounded h-3 mt-1 shadow-inner"><div className="bg-blue-500 h-full rounded" style={{ width: `${(playerCurrentHP / playerCharacter.hp) * 100}%` }}></div></div>
                </div>
                
                {/* Animation Display Area */}
                <div className="h-12 my-2">
                    <AnimationDisplay text={`${playerCharacter.name} の攻撃！`} isVisible={isAnimating && isPlayerTurn && !battleResult} />
                    <AnimationDisplay text={`${enemy.name} ${enemy.appearance} の攻撃！`} isVisible={isAnimating && !isPlayerTurn && !battleResult} />
                    {battleResult === 'victory' && isAnimating && <AnimationDisplay text={`${enemy.name} を倒した！`} isVisible={true} />}
                    {battleResult === 'defeat' && isAnimating && <AnimationDisplay text={`${playerCharacter.name} は倒れた...`} isVisible={true} />}
                </div>


                {/* Battle Log */}
                <div className="h-24 mb-4 p-2 border border-gray-700 rounded overflow-y-auto bg-black bg-opacity-30 text-sm">
                    {battleLog.map((log, index) => <p key={index} className="mb-1">{log}</p>)}
                </div>

                {/* Controls */}
                {!battleResult && (
                    <div className="flex justify-center space-x-4">
                        <button 
                            onClick={handlePlayerAttack}
                            disabled={!isPlayerTurn || !!isAnimating || !!battleResult}
                            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                        >
                            たたかう
                        </button>
                    </div>
                )}
                 {!battleResult && !isPlayerTurn && !isAnimating && (
                    <p className="text-center text-gray-400 mt-4">相手のターン...</p>
                )}
                 {!battleResult && !isPlayerTurn && isAnimating && ( 
                    <p className="text-center text-gray-400 mt-4">相手が行動中...</p>
                )}

                {battleResult && !isAnimating && displayedRewards && (
                    <div className="text-center mt-6">
                        {battleResult === 'victory' && <p className="text-2xl text-green-400 mb-3 animate-bounce">勝利！</p>}
                        {battleResult === 'defeat' && <p className="text-2xl text-red-500 mb-3">敗北...</p>}
                        
                        <div className="my-4 p-3 bg-gray-700 rounded text-left text-sm">
                            <h4 className="text-md font-semibold mb-2 text-yellow-300 border-b border-gray-600 pb-1">獲得結果:</h4>
                            {displayedRewards.xpGained > 0 && <p>{party.map(p=>p.name).join('と')} は経験値 +{displayedRewards.xpGained}！</p>}
                            {displayedRewards.foodFound > 0 && <p>食べ物 +{displayedRewards.foodFound}個！</p>}
                            {displayedRewards.tokensFound > 0 && <p>ガチャ券 +{displayedRewards.tokensFound}枚！</p>}
                            {displayedRewards.newAnimalTypeToCreate && <p>新しい仲間 ({ANIMAL_EMOJIS_prop[displayedRewards.newAnimalTypeToCreate] || '？'}) の気配がする！</p>}
                            
                            {!(displayedRewards.xpGained > 0) && 
                             !(displayedRewards.foodFound > 0) && 
                             !(displayedRewards.tokensFound > 0) && 
                             !displayedRewards.newAnimalTypeToCreate &&
                                <p>特にめぼしいものはなかった...</p>
                            }
                        </div>

                        <button 
                            onClick={() => onAdventureComplete(displayedRewards)} 
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold text-lg"
                        >
                            OK
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}