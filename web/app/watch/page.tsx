'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { PixelSumo } from '@/components/PixelSumo'
import { getApiUrl } from '@/lib/api'
import {
    WAITING_DOTS_INTERVAL_MS,
    ACTIVE_MATCH_POLL_INTERVAL_MS,
    RING_OUT_PHASE_MS,
    DECISION_PHASE_MS,
    WINNER_DISPLAY_MS,
    RING_SIZE,
    ENGINE_WIDTH,
    ENGINE_HEIGHT,
    WRESTLER_SPRITE_SIZE,
    COLLISION_SHAKE_DURATION_MS,
    POSITION_LERP_FACTOR,
    SKILL_POPUP_DURATION_MS
} from '@/lib/constants'

const PIXEL_FONT = "'Press Start 2P', 'Courier New', monospace"
const DEMO_POLL_INTERVAL_MS = 50  // 20 FPS for demo mode

// Game states from backend
const STATE_WAITING = "WAITING"
const STATE_P1_READY = "P1_READY"
const STATE_P2_READY = "P2_READY"
const STATE_COUNTDOWN = "COUNTDOWN"  // 3-2-1-GO countdown
const STATE_FIGHTING = "FIGHTING"
const STATE_MATTA = "MATTA"
const STATE_GAME_OVER = "GAME_OVER"

interface SkillEvent {
    type: string
    wrestler_id?: string
    wrestler_name?: string
    skill_name?: string
    skill_jp?: string
    message?: string
    offender?: string
    timestamp: number
}

interface WrestlerState {
    id: string
    x: number
    y: number
    name: string
    custom_name?: string
    color: string
    avatar_seed?: number
    stamina?: number
}

interface MatchState {
    state: string
    p1: WrestlerState
    p2: WrestlerState
    game_over: boolean
    winner?: string
    winner_name?: string
    collision?: boolean
    events?: SkillEvent[]
    p1_edge_danger?: number
    p2_edge_danger?: number
    p1_matta?: number
    p2_matta?: number
    matta_player?: string
    countdown_remaining?: number  // 3-2-1-GO countdown seconds
    t: number
    is_demo?: boolean
    demo_label?: string
}

// Particle component
function ImpactParticle({ x, y, delay }: { x: number; y: number; delay: number }) {
    return (
        <div style={{
            position: 'absolute',
            left: x,
            top: y,
            width: 8,
            height: 8,
            background: 'rgba(255, 220, 150, 0.9)',
            borderRadius: '50%',
            animation: `particle-burst 0.4s ease-out ${delay}ms forwards`,
            pointerEvents: 'none'
        }} />
    )
}

// Stamina Bar Component
function StaminaBar({
    percentage,
    side,
    color
}: {
    percentage: number;
    side: 'left' | 'right';
    color: string
}) {
    // Color logic: >50% Green, 20-50% Yellow, <20% Red
    let barColor = '#4cd137'
    if (percentage < 20) barColor = '#e84118'
    else if (percentage < 50) barColor = '#fbc531'

    return (
        <div style={{
            position: 'absolute',
            [side]: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 12,
            height: 200,
            background: 'rgba(0,0,0,0.6)',
            border: `2px solid rgba(255,255,255,0.2)`,
            borderRadius: 6,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column-reverse', // Fill from bottom
            zIndex: 40
        }}>
            <div style={{
                width: '100%',
                height: `${percentage}%`,
                background: barColor,
                transition: 'height 0.1s linear, background 0.3s ease',
                boxShadow: `0 0 10px ${barColor}`,
                animation: percentage < 20 ? 'stamina-pulse 0.5s infinite' : 'none'
            }} />
        </div>
    )
}

export default function WatchPage() {
    const [connected, setConnected] = useState(false)
    const [matchId, setMatchId] = useState<string | null>(null)
    const [matchState, setMatchState] = useState<MatchState | null>(null)
    const [waitingDots, setWaitingDots] = useState('')
    const [connectionStatus, setConnectionStatus] = useState<string>('idle')
    const [isShaking, setIsShaking] = useState(false)
    const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([])
    const [activeSkills, setActiveSkills] = useState<{ event: SkillEvent; side: 'left' | 'right' }[]>([])
    const [showWinner, setShowWinner] = useState(false)
    const [winnerData, setWinnerData] = useState<{ name: string; color: string; seed: number; loserName?: string; loserColor?: string; loserSeed?: number } | null>(null)
    const [showMatta, setShowMatta] = useState(false)
    const [mattaPlayer, setMattaPlayer] = useState<string | null>(null)
    const [showTachiai, setShowTachiai] = useState(false)
    const [showDecision, setShowDecision] = useState(false) // SHOBU-ARI state
    const [showRingOut, setShowRingOut] = useState(false)   // RING OUT! dramatic phase

    // Demo mode state - START IN DEMO MODE BY DEFAULT
    const [demoMode, setDemoMode] = useState(true)
    const [demoState, setDemoState] = useState<MatchState | null>(null)
    const demoPollRef = useRef<NodeJS.Timeout | null>(null)

    const currentMatchIdRef = useRef<string | null>(null)
    const particleIdRef = useRef(0)
    const winnerTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const [displayP1, setDisplayP1] = useState<{ x: number, y: number } | null>(null)
    const [displayP2, setDisplayP2] = useState<{ x: number, y: number } | null>(null)

    const wsRef = useRef<WebSocket | null>(null)
    const pollRef = useRef<NodeJS.Timeout | null>(null)
    const shakeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const API_BASE = getApiUrl()

    useEffect(() => {
        const interval = setInterval(() => {
            setWaitingDots(prev => (prev.length >= 3 ? '' : prev + '.'))
        }, WAITING_DOTS_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const checkForMatch = async () => {
            try {
                const res = await fetch(`${API_BASE}/matches/active`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.match_id && data.match_id !== currentMatchIdRef.current) {
                        // Real match found - disable demo mode
                        setDemoMode(false)
                        setDemoState(null)
                        if (demoPollRef.current) {
                            clearInterval(demoPollRef.current)
                            demoPollRef.current = null
                        }

                        if (showWinner) {
                            setShowWinner(false)
                            setWinnerData(null)
                            if (winnerTimeoutRef.current) {
                                clearTimeout(winnerTimeoutRef.current)
                            }
                        }
                        if (wsRef.current) wsRef.current.close()
                        setMatchState(null)
                        setDisplayP1(null)
                        setDisplayP2(null)
                        setActiveSkills([])
                        setConnected(false)
                        setShowMatta(false)
                        setShowTachiai(false)
                        setMatchId(data.match_id)
                        currentMatchIdRef.current = data.match_id
                    }
                    // Note: Demo mode starts true by default, only disabled when real match found
                }
            } catch { /* silent */ }
        }

        pollRef.current = setInterval(checkForMatch, ACTIVE_MATCH_POLL_INTERVAL_MS)
        checkForMatch()
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [API_BASE, showWinner])

    const spawnParticles = useCallback((centerX: number, centerY: number) => {
        const newParticles: { id: number; x: number; y: number }[] = []
        for (let i = 0; i < 8; i++) {
            newParticles.push({
                id: particleIdRef.current++,
                x: centerX + (Math.random() - 0.5) * 50,
                y: centerY + (Math.random() - 0.5) * 50
            })
        }
        setParticles(prev => [...prev, ...newParticles])
        setTimeout(() => {
            setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)))
        }, 500)
    }, [])

    // Demo mode polling
    useEffect(() => {
        if (!demoMode || matchId) {
            // Not in demo mode or real match active
            if (demoPollRef.current) {
                clearInterval(demoPollRef.current)
                demoPollRef.current = null
            }
            return
        }

        const pollDemo = async () => {
            try {
                const res = await fetch(`${API_BASE}/demo/state`)
                if (res.ok) {
                    const data = await res.json()
                    setDemoState(data)
                }
            } catch { /* silent */ }
        }

        demoPollRef.current = setInterval(pollDemo, DEMO_POLL_INTERVAL_MS)
        pollDemo() // Initial poll

        return () => {
            if (demoPollRef.current) {
                clearInterval(demoPollRef.current)
                demoPollRef.current = null
            }
        }
    }, [demoMode, matchId, API_BASE])

    useEffect(() => {
        if (!matchId) return

        let wsUrl: string
        if (API_BASE.includes('http')) {
            wsUrl = API_BASE.replace('https://', 'wss://').replace('http://', 'ws://').replace('/api', '') + `/ws/${matchId}`
        } else {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            wsUrl = `${wsProtocol}//${window.location.host}/ws/${matchId}`
        }

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            setConnected(true)
            setConnectionStatus('connected')
        }

        ws.onmessage = (event) => {
            try {
                const data: MatchState = JSON.parse(event.data)
                setMatchState(data)

                // Handle collision effects
                if (data.collision) {
                    setIsShaking(true)
                    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current)
                    shakeTimeoutRef.current = setTimeout(() => setIsShaking(false), COLLISION_SHAKE_DURATION_MS)

                    if (data.p1 && data.p2) {
                        const cx = ((data.p1.x + data.p2.x) / 2 / ENGINE_WIDTH) * RING_SIZE
                        const cy = ((data.p1.y + data.p2.y) / 2 / ENGINE_HEIGHT) * RING_SIZE
                        spawnParticles(cx, cy)
                    }
                }

                // Handle events
                if (data.events && data.events.length > 0) {
                    data.events.forEach(evt => {
                        if (evt.type === 'skill') {
                            const side = evt.wrestler_id === data.p1.id ? 'left' : 'right'
                            setActiveSkills(prev => [...prev, { event: evt, side }])
                            setTimeout(() => {
                                setActiveSkills(prev => prev.filter(s => s.event.timestamp !== evt.timestamp))
                            }, SKILL_POPUP_DURATION_MS)
                        } else if (evt.type === 'matta') {
                            setShowMatta(true)
                            setMattaPlayer(evt.offender || null)
                            setTimeout(() => setShowMatta(false), 1500)
                        } else if (evt.type === 'tachiai') {
                            setShowTachiai(true)
                            setTimeout(() => setShowTachiai(false), 1000)
                        }
                    })
                }

                // Handle game over - Sequence: RING OUT (3s) -> SHOBU-ARI (3s) -> WINNER (8s) -> RESET
                if (data.game_over && data.winner_name && !showWinner && !showDecision && !showRingOut) {
                    const isP1Winner = data.winner === data.p1.id
                    const loser = isP1Winner ? data.p2 : data.p1
                    setWinnerData({
                        name: data.winner_name,
                        color: isP1Winner ? data.p1.color : data.p2.color,
                        seed: isP1Winner ? (data.p1.avatar_seed || 0) : (data.p2.avatar_seed || 0),
                        loserName: loser.custom_name || loser.name,
                        loserColor: loser.color,
                        loserSeed: loser.avatar_seed || 0
                    })

                    // Phase 1: RING OUT! (dramatic pause with screen shake)
                    setShowRingOut(true)
                    setIsShaking(true)
                    setTimeout(() => setIsShaking(false), 500)

                    // Phase 2: Decision/SHOBU-ARI (after RING_OUT_PHASE)
                    setTimeout(() => {
                        setShowRingOut(false)
                        setShowDecision(true)
                    }, RING_OUT_PHASE_MS)

                    // Phase 3: Winner Announcement (after RING_OUT + DECISION)
                    setTimeout(() => {
                        setShowDecision(false)
                        setShowWinner(true)

                        // Phase 4: Reset (after WINNER display)
                        winnerTimeoutRef.current = setTimeout(() => {
                            setShowWinner(false)
                            setWinnerData(null)
                            setMatchId(null)
                            setMatchState(null)
                            setConnected(false)
                            currentMatchIdRef.current = null
                        }, WINNER_DISPLAY_MS)
                    }, RING_OUT_PHASE_MS + DECISION_PHASE_MS)
                }
            } catch (e) {
                console.error('[Watch] Parse error:', e)
            }
        }

        ws.onerror = () => {
            console.warn('[Watch] WebSocket error')
            setConnectionStatus('error')
        }

        ws.onclose = (event) => {
            console.warn(`[Watch] WebSocket closed: code=${event.code}, reason=${event.reason}`)
            setConnected(false)

            // Auto-reconnect after 2 seconds if match is still active
            if (matchId && !showWinner) {
                console.log('[Watch] Attempting reconnect in 2s...')
                setTimeout(() => {
                    // Force a re-render by clearing and resetting matchId
                    // This triggers the useEffect to create a new WebSocket
                    setMatchId(null)
                    setTimeout(() => {
                        setMatchId(matchId)
                    }, 100)
                }, 2000)
            }
        }

        return () => {
            ws.close()
            if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current)
        }
    }, [matchId, spawnParticles, showWinner])

    // Standard position updates from network
    useEffect(() => {
        if (!matchState || showRingOut) return // Skip standard updates if showing ring out

        const lerp = (a: number, b: number, t: number) => a + (b - a) * t
        setDisplayP1(prev => {
            if (!prev) return { x: matchState.p1.x, y: matchState.p1.y }
            return { x: lerp(prev.x, matchState.p1.x, POSITION_LERP_FACTOR), y: lerp(prev.y, matchState.p1.y, POSITION_LERP_FACTOR) }
        })
        setDisplayP2(prev => {
            if (!prev) return { x: matchState.p2.x, y: matchState.p2.y }
            return { x: lerp(prev.x, matchState.p2.x, POSITION_LERP_FACTOR), y: lerp(prev.y, matchState.p2.y, POSITION_LERP_FACTOR) }
        })
    }, [matchState, showRingOut])

    // Active animation loop for Ring Out (runs independently of network)
    useEffect(() => {
        if (!showRingOut || !matchState) return

        const isP1Winner = matchState.winner === matchState.p1.id
        const p1IsLoser = !!matchState.winner_name && !isP1Winner
        const p2IsLoser = !!matchState.winner_name && isP1Winner

        // Helper to calculate target position well outside the ring
        const getTargetPos = (wrestlerPos: { x: number, y: number }, isLoser: boolean) => {
            if (!isLoser) return wrestlerPos

            const centerX = ENGINE_WIDTH / 2
            const centerY = ENGINE_HEIGHT / 2
            const dx = wrestlerPos.x - centerX
            const dy = wrestlerPos.y - centerY
            const currentDist = Math.sqrt(dx * dx + dy * dy) || 1

            const TARGET_DIST = 35 // Push even further out (was 28)
            const scale = TARGET_DIST / currentDist
            return { x: centerX + dx * scale, y: centerY + dy * scale }
        }

        const p1Target = getTargetPos(matchState.p1, p1IsLoser)
        const p2Target = getTargetPos(matchState.p2, p2IsLoser)

        let animationFrameId: number

        const animate = () => {
            // Slower lerp for dramatic "falling out" effect
            const FALL_LERP = 0.05

            setDisplayP1(prev => {
                if (!prev) return prev
                return {
                    x: prev.x + (p1Target.x - prev.x) * FALL_LERP,
                    y: prev.y + (p1Target.y - prev.y) * FALL_LERP
                }
            })
            setDisplayP2(prev => {
                if (!prev) return prev
                return {
                    x: prev.x + (p2Target.x - prev.x) * FALL_LERP,
                    y: prev.y + (p2Target.y - prev.y) * FALL_LERP
                }
            })
            animationFrameId = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animationFrameId)
    }, [showRingOut]) // Run only when entering/exiting ring out phase

    const engineToRing = (engineX: number, engineY: number) => ({
        x: (engineX / ENGINE_WIDTH) * RING_SIZE,
        y: (engineY / ENGINE_HEIGHT) * RING_SIZE
    })

    const getWrestlerName = (wrestler: WrestlerState) => wrestler.custom_name || wrestler.name || 'Unknown'

    // Get state label for match status
    const getStateLabel = () => {
        if (!matchState) return null
        switch (matchState.state) {
            case STATE_WAITING: return "READY?"
            case STATE_P1_READY: return "P1 READY..."
            case STATE_P2_READY: return "P2 READY..."
            case STATE_FIGHTING: return null
            case STATE_MATTA: return null
            default: return null
        }
    }

    // Helper to convert engine coords to ring coords for demo
    const demoP1Pos = demoState?.p1 ? engineToRing(demoState.p1.x, demoState.p1.y) : null
    const demoP2Pos = demoState?.p2 ? engineToRing(demoState.p2.x, demoState.p2.y) : null

    // Waiting for match screen - show demo if available
    if (!matchId || !connected) {
        // If in demo mode and have demo state, show animated demo match
        if (demoMode && demoState && demoState.p1 && demoState.p2) {
            return (
                <div style={{
                    minHeight: '100vh',
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: PIXEL_FONT,
                    color: '#fff',
                    padding: 20,
                    position: 'relative'
                }}>
                    <style>{`
                        @keyframes demo-pulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
                    `}</style>

                    {/* DEMO Badge */}
                    <div style={{
                        position: 'absolute',
                        top: 20,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                        padding: '8px 24px',
                        borderRadius: 8,
                        border: '3px solid #fff',
                        zIndex: 100,
                        animation: 'demo-pulse 2s infinite'
                    }}>
                        <span style={{ fontSize: 14, fontWeight: 'bold', textShadow: '2px 2px 0 #000' }}>
                            🎮 DEMO MATCH
                        </span>
                    </div>

                    {/* Demo Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: RING_SIZE, marginBottom: 15, alignItems: 'center' }}>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ fontSize: 12, color: `rgb(${demoState.p1.color})`, textShadow: '2px 2px 0 #000', margin: 0 }}>
                                {demoState.p1.custom_name || demoState.p1.name}
                            </p>
                            <p style={{ fontSize: 8, color: '#888', margin: 0 }}>WEST</p>
                        </div>
                        <span style={{ fontSize: 10, color: '#c9a227' }}>VS</span>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 12, color: `rgb(${demoState.p2.color})`, textShadow: '2px 2px 0 #000', margin: 0 }}>
                                {demoState.p2.custom_name || demoState.p2.name}
                            </p>
                            <p style={{ fontSize: 8, color: '#888', margin: 0 }}>EAST</p>
                        </div>
                    </div>

                    {/* Demo Dohyo */}
                    <div style={{
                        width: RING_SIZE,
                        height: RING_SIZE,
                        borderRadius: '50%',
                        border: '6px solid #c9a227',
                        background: 'radial-gradient(circle, #d4a574 0%, #a67c52 100%)',
                        position: 'relative',
                        boxShadow: '0 0 30px rgba(201, 162, 39, 0.4)'
                    }}>
                        <div style={{
                            position: 'absolute', top: 15, left: 15, right: 15, bottom: 15,
                            borderRadius: '50%', border: '3px solid #8b4513'
                        }} />

                        {/* P1 */}
                        {demoP1Pos && (
                            <div style={{
                                position: 'absolute', left: `${demoP1Pos.x}px`, top: `${demoP1Pos.y}px`,
                                transform: 'translate(-50%, -50%) scaleX(-1)'
                            }}>
                                <PixelSumo seed={demoState.p1.avatar_seed || 12345} color={demoState.p1.color} size={WRESTLER_SPRITE_SIZE * 0.8} />
                            </div>
                        )}

                        {/* P2 */}
                        {demoP2Pos && (
                            <div style={{
                                position: 'absolute', left: `${demoP2Pos.x}px`, top: `${demoP2Pos.y}px`,
                                transform: 'translate(-50%, -50%)'
                            }}>
                                <PixelSumo seed={demoState.p2.avatar_seed || 54321} color={demoState.p2.color} size={WRESTLER_SPRITE_SIZE * 0.8} />
                            </div>
                        )}
                    </div>

                    {/* Footer text */}
                    <p style={{ fontSize: 10, color: '#888', marginTop: 20, textAlign: 'center' }}>
                        START A MATCH FROM CONTROLLER
                    </p>
                    <p style={{ fontSize: 8, color: '#555', marginTop: 5 }}>
                        Watching demo simulation{waitingDots}
                    </p>
                </div>
            )
        }

        // Fallback: Static waiting screen (before demo loads)
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: PIXEL_FONT,
                color: '#fff',
                padding: 20,
                textAlign: 'center'
            }}>
                <div style={{
                    width: 200,
                    height: 200,
                    borderRadius: '50%',
                    border: '8px solid #c9a227',
                    background: 'radial-gradient(circle, #d4a574 0%, #a67c52 100%)',
                    marginBottom: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 40px rgba(201, 162, 39, 0.3)'
                }}>
                    <svg width="80" height="80" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
                        <circle cx="16" cy="16" r="14" fill="none" stroke="#f5deb3" strokeWidth="3" />
                        <circle cx="16" cy="16" r="11" fill="#c9a05c" />
                        <rect x="10" y="15" width="4" height="2" fill="#8b4513" />
                        <rect x="18" y="15" width="4" height="2" fill="#8b4513" />
                    </svg>
                </div>
                <h1 style={{ fontSize: 24, marginBottom: 20, textShadow: '2px 2px 0 #000' }}>大相撲</h1>
                <p style={{ fontSize: 14, color: '#aaa', marginBottom: 10 }}>SUMO SMASH</p>
                <p style={{ fontSize: 12, color: '#ffcc00', minWidth: 200 }}>
                    WAITING FOR MATCH{waitingDots}
                </p>
            </div>
        )
    }

    const p1Pos = displayP1 ? engineToRing(displayP1.x, displayP1.y) : null
    const p2Pos = displayP2 ? engineToRing(displayP2.x, displayP2.y) : null
    const stateLabel = getStateLabel()

    // Edge danger colors
    const p1EdgeDanger = matchState?.p1_edge_danger || 0
    const p2EdgeDanger = matchState?.p2_edge_danger || 0

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: PIXEL_FONT,
            color: '#fff',
            padding: 20,
            position: 'relative'
        }}>
            <style>{`
                @keyframes particle-burst { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(0); opacity: 0; } }
                @keyframes skill-popup { 0% { transform: translateY(20px) scale(0.8); opacity: 0; } 15% { transform: translateY(0) scale(1.1); opacity: 1; } 30% { transform: scale(1); } 85% { opacity: 1; } 100% { transform: translateY(-10px); opacity: 0; } }
                @keyframes winner-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
                @keyframes matta-flash { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                @keyframes tachiai-burst { 
                    0% { transform: scale(0.5); opacity: 0; } 
                    50% { transform: scale(1.2); opacity: 1; } 
                    100% { transform: scale(1); opacity: 1; } 
                }
                @keyframes ringout-pulse {
                    0% { opacity: 0.8; box-shadow: inset 0 0 50px rgba(255, 0, 0, 0.5); }
                    100% { opacity: 1; box-shadow: inset 0 0 150px rgba(255, 0, 0, 0.8); }
                }
                @keyframes edge-pulse { 0%, 100% { box-shadow: 0 0 20px rgba(255, 0, 0, 0.3); } 50% { box-shadow: 0 0 40px rgba(255, 0, 0, 0.8); } }
                @keyframes stamina-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                @keyframes countdown-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
            `}</style>

            {/* Stamina Bars */}
            {matchState?.p1 && (
                <StaminaBar
                    percentage={matchState.p1.stamina ?? 100}
                    side="left"
                    color={matchState.p1.color}
                />
            )}
            {matchState?.p2 && (
                <StaminaBar
                    percentage={matchState.p2.stamina ?? 100}
                    side="right"
                    color={matchState.p2.color}
                />
            )}

            {/* Skill Popups */}
            <div style={{ position: 'fixed', left: 20, top: '40%', zIndex: 60 }}>
                {activeSkills.filter(s => s.side === 'left').map((s, i) => (
                    <div key={`${s.event.timestamp}-${i}`} style={{
                        background: 'linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(30,30,60,0.95) 100%)',
                        border: '3px solid #ffcc00',
                        borderRadius: 8,
                        padding: '12px 20px',
                        marginBottom: 10,
                        animation: 'skill-popup 1.5s ease-out forwards',
                        boxShadow: '0 0 30px rgba(255, 204, 0, 0.6)'
                    }}>
                        <div style={{ fontSize: 16, color: '#ffcc00' }}>{s.event.skill_name}</div>
                        <div style={{ fontSize: 10, color: '#888' }}>{s.event.skill_jp}</div>
                    </div>
                ))}
            </div>
            <div style={{ position: 'fixed', right: 20, top: '40%', zIndex: 60 }}>
                {activeSkills.filter(s => s.side === 'right').map((s, i) => (
                    <div key={`${s.event.timestamp}-${i}`} style={{
                        background: 'linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(30,30,60,0.95) 100%)',
                        border: '3px solid #ffcc00',
                        borderRadius: 8,
                        padding: '12px 20px',
                        marginBottom: 10,
                        animation: 'skill-popup 1.5s ease-out forwards',
                        boxShadow: '0 0 30px rgba(255, 204, 0, 0.6)'
                    }}>
                        <div style={{ fontSize: 16, color: '#ffcc00' }}>{s.event.skill_name}</div>
                        <div style={{ fontSize: 10, color: '#888' }}>{s.event.skill_jp}</div>
                    </div>
                ))}
            </div>

            {/* MATTA Overlay */}
            {showMatta && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(255, 0, 0, 0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 80, animation: 'matta-flash 0.3s ease-in-out 3'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 48, color: '#ff4444', textShadow: '3px 3px 0 #000' }}>待った!</p>
                        <p style={{ fontSize: 24, color: '#fff', marginTop: 10 }}>MATTA!</p>
                        <p style={{ fontSize: 14, color: '#aaa', marginTop: 10 }}>
                            False Start - {mattaPlayer?.toUpperCase()}
                        </p>
                    </div>
                </div>
            )}

            {/* COUNTDOWN Overlay - 3...2...1...GO! */}
            {matchState?.state === STATE_COUNTDOWN && matchState.countdown_remaining !== undefined && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 90
                }}>
                    <div style={{ textAlign: 'center', animation: 'countdown-pulse 1s infinite' }}>
                        <p style={{
                            fontSize: 120,
                            color: '#ffcc00',
                            textShadow: '4px 4px 0 #000, 0 0 50px rgba(255, 204, 0, 0.5)',
                            margin: 0,
                            fontFamily: PIXEL_FONT
                        }}>
                            {Math.ceil(matchState.countdown_remaining)}
                        </p>
                        <p style={{
                            fontSize: 24,
                            color: '#fff',
                            marginTop: 20,
                            textShadow: '2px 2px 0 #000'
                        }}>
                            {matchState.countdown_remaining > 2 ? '三' : matchState.countdown_remaining > 1 ? '二' : '一'}
                        </p>
                        <p style={{ fontSize: 14, color: '#aaa', marginTop: 30 }}>GET READY!</p>
                    </div>
                </div>
            )}

            {/* TACHIAI Burst */}
            {showTachiai && (
                <div style={{
                    position: 'fixed', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 70, animation: 'tachiai-burst 1s ease-out forwards'
                }}>
                    <p style={{ fontSize: 36, color: '#ffcc00', textShadow: '3px 3px 0 #000' }}>TACHIAI!</p>
                </div>
            )}

            {/* State Label */}
            {stateLabel && (
                <div style={{
                    position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.8)', padding: '10px 20px', borderRadius: 8,
                    border: '2px solid #ffcc00', zIndex: 50
                }}>
                    <p style={{ fontSize: 18, color: '#ffcc00', margin: 0 }}>{stateLabel}</p>
                </div>
            )}

            {/* Match Header - P1 (West) Left, P2 (East) Right */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: RING_SIZE, marginBottom: 20, alignItems: 'center' }}>
                <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: 14, color: `rgb(${matchState?.p1?.color || '255,255,255'})`, textShadow: '2px 2px 0 #000', margin: 0 }}>
                        {matchState?.p1 ? getWrestlerName(matchState.p1) : 'P1'}
                    </p>
                    {matchState?.p1_matta ? <p style={{ fontSize: 10, color: '#ff6666', margin: 0 }}>MATTA: {matchState.p1_matta}/2</p> : null}
                    <p style={{ fontSize: 10, color: '#888', margin: 0 }}>WEST</p>
                </div>
                <span style={{ fontSize: 12, color: '#c9a227' }}>VS</span>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 14, color: `rgb(${matchState?.p2?.color || '255,255,255'})`, textShadow: '2px 2px 0 #000', margin: 0 }}>
                        {matchState?.p2 ? getWrestlerName(matchState.p2) : 'P2'}
                    </p>
                    {matchState?.p2_matta ? <p style={{ fontSize: 10, color: '#ff6666', margin: 0 }}>MATTA: {matchState.p2_matta}/2</p> : null}
                    <p style={{ fontSize: 10, color: '#888', margin: 0 }}>EAST</p>
                </div>
            </div>

            {/* Dohyo with edge danger glow */}
            <div style={{
                width: RING_SIZE,
                height: RING_SIZE,
                borderRadius: '50%',
                border: '8px solid #c9a227',
                background: 'radial-gradient(circle, #d4a574 0%, #a67c52 100%)',
                position: 'relative',
                boxShadow: `0 0 ${20 + Math.max(p1EdgeDanger, p2EdgeDanger) * 40}px rgba(${Math.max(p1EdgeDanger, p2EdgeDanger) > 0.7 ? '255, 50, 50' : '201, 162, 39'}, ${0.3 + Math.max(p1EdgeDanger, p2EdgeDanger) * 0.5})`,
                transform: isShaking ? `translate(${Math.random() * 8 - 4}px, ${Math.random() * 8 - 4}px)` : 'none',
                transition: isShaking ? 'none' : 'transform 0.1s ease-out, box-shadow 0.3s ease',
                animation: Math.max(p1EdgeDanger, p2EdgeDanger) > 0.8 ? 'edge-pulse 0.5s infinite' : 'none'
            }}>
                <div style={{
                    position: 'absolute', top: 20, left: 20, right: 20, bottom: 20,
                    borderRadius: '50%', border: '4px solid #8b4513'
                }} />

                {particles.map((p, i) => <ImpactParticle key={p.id} x={p.x} y={p.y} delay={i * 30} />)}

                {matchState?.p1 && p1Pos && (
                    <div style={{
                        position: 'absolute', left: `${p1Pos.x}px`, top: `${p1Pos.y}px`,
                        transform: 'translate(-50%, -50%) scaleX(-1)', // P1 is East (Right), faces Left
                        filter: p1EdgeDanger > 0.7 ? `drop-shadow(0 0 ${p1EdgeDanger * 10}px rgba(255, 0, 0, 0.8))` : 'none'
                    }}>
                        <PixelSumo seed={matchState.p1.avatar_seed || 0} color={matchState.p1.color} size={WRESTLER_SPRITE_SIZE} />
                    </div>
                )}

                {matchState?.p2 && p2Pos && (
                    <div style={{
                        position: 'absolute', left: `${p2Pos.x}px`, top: `${p2Pos.y}px`,
                        transform: 'translate(-50%, -50%)', // P2 is West (Left), faces Right
                        filter: p2EdgeDanger > 0.7 ? `drop-shadow(0 0 ${p2EdgeDanger * 10}px rgba(255, 0, 0, 0.8))` : 'none'
                    }}>
                        <PixelSumo seed={matchState.p2.avatar_seed || 0} color={matchState.p2.color} size={WRESTLER_SPRITE_SIZE} />
                    </div>
                )}
            </div>

            {/* RING OUT! Overlay - Dramatic moment of victory */}
            {showRingOut && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(100, 0, 0, 0.4)', // Red tint for drama
                    border: '8px solid #ff3333',
                    boxShadow: 'inset 0 0 100px rgba(255, 0, 0, 0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 96,
                    animation: 'ringout-pulse 0.5s ease-in-out infinite alternate'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{
                            fontSize: 72,
                            color: '#ff3333',
                            textShadow: '4px 4px 0 #000, -2px -2px 0 #000',
                            fontFamily: PIXEL_FONT,
                            margin: 0,
                            animation: 'tachiai-burst 0.5s ease-out forwards'
                        }}>
                            RING OUT!
                        </p>
                    </div>
                </div>
            )}

            {/* Decision Overlay - SHOBU-ARI */}
            {showDecision && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.3)', // Semi-transparent to see the ring out
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 95
                }}>
                    <div style={{ textAlign: 'center', animation: 'tachiai-burst 0.5s ease-out forwards' }}>
                        <p style={{
                            fontSize: 60,
                            color: '#fff',
                            textShadow: '4px 4px 0 #000',
                            fontFamily: PIXEL_FONT,
                            margin: 0
                        }}>
                            SHOBU-ARI!
                        </p>
                        <p style={{
                            fontSize: 24,
                            color: '#ffcc00',
                            marginTop: 10,
                            textShadow: '2px 2px 0 #000'
                        }}>
                            MATCH CONCLUDED
                        </p>
                    </div>
                </div>
            )}

            {/* Winner Overlay */}
            {showWinner && winnerData && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.9)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    zIndex: 100
                }}>
                    <p style={{ fontSize: 16, color: '#888', marginBottom: 10 }}>WINNER</p>
                    <p style={{ fontSize: 24, color: '#ffcc00', marginBottom: 30, textShadow: '2px 2px 0 #000' }}>WINNER</p>
                    <div style={{ marginBottom: 20, animation: 'winner-pulse 1s infinite' }}>
                        <PixelSumo seed={winnerData.seed} color={winnerData.color} size={128} />
                    </div>
                    <p style={{ fontSize: 28, color: '#fff', textShadow: '2px 2px 0 #000' }}>{winnerData.name}</p>
                    <p style={{ fontSize: 10, color: '#666', marginTop: 40 }}>Returning to lobby...</p>
                </div>
            )}
        </div>
    )
}
