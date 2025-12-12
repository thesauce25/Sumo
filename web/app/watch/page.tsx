'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { PixelSumo } from '@/components/PixelSumo'
import {
    WAITING_DOTS_INTERVAL_MS,
    ACTIVE_MATCH_POLL_INTERVAL_MS,
    GAME_OVER_RESET_DELAY_MS,
    RING_SIZE,
    ENGINE_WIDTH,
    ENGINE_HEIGHT,
    WRESTLER_SPRITE_SIZE,
    COLLISION_SHAKE_DURATION_MS,
    POSITION_LERP_FACTOR,
    SKILL_POPUP_DURATION_MS
} from '@/lib/constants'

const PIXEL_FONT = "'Press Start 2P', 'Courier New', monospace"

interface SkillEvent {
    type: string
    wrestler_id: string
    wrestler_name: string
    skill_name: string
    skill_jp: string
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
}

interface MatchState {
    p1: WrestlerState
    p2: WrestlerState
    game_over: boolean
    winner?: string
    winner_name?: string
    collision?: boolean
    events?: SkillEvent[]
    t: number
}

// Particle component for impact effects
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
    const [winnerData, setWinnerData] = useState<{ name: string; color: string; seed: number } | null>(null)

    // Track current match to detect new ones
    const currentMatchIdRef = useRef<string | null>(null)
    const particleIdRef = useRef(0)
    const winnerTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Smooth position interpolation
    const [displayP1, setDisplayP1] = useState<{ x: number, y: number } | null>(null)
    const [displayP2, setDisplayP2] = useState<{ x: number, y: number } | null>(null)

    const wsRef = useRef<WebSocket | null>(null)
    const pollRef = useRef<NodeJS.Timeout | null>(null)
    const shakeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://sumo-server-1056239062336.us-central1.run.app/api'

    // Animate waiting dots
    useEffect(() => {
        const interval = setInterval(() => {
            setWaitingDots(prev => (prev.length >= 3 ? '' : prev + '.'))
        }, WAITING_DOTS_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [])

    // ALWAYS poll for active matches - even during winner screen
    useEffect(() => {
        const checkForMatch = async () => {
            try {
                const res = await fetch(`${API_BASE}/matches/active`)
                if (res.ok) {
                    const data = await res.json()
                    // If there's a NEW match (different ID), immediately switch to it
                    if (data.match_id && data.match_id !== currentMatchIdRef.current) {
                        console.log('[Watch] New match detected:', data.match_id)

                        // Clear winner screen if showing
                        if (showWinner) {
                            setShowWinner(false)
                            setWinnerData(null)
                            if (winnerTimeoutRef.current) {
                                clearTimeout(winnerTimeoutRef.current)
                                winnerTimeoutRef.current = null
                            }
                        }

                        // Close existing websocket
                        if (wsRef.current) {
                            wsRef.current.close()
                        }

                        // Reset state for new match
                        setMatchState(null)
                        setDisplayP1(null)
                        setDisplayP2(null)
                        setActiveSkills([])
                        setConnected(false)

                        // Set new match
                        setMatchId(data.match_id)
                        currentMatchIdRef.current = data.match_id
                    }
                }
            } catch {
                // Silently fail
            }
        }

        // Poll continuously
        pollRef.current = setInterval(checkForMatch, ACTIVE_MATCH_POLL_INTERVAL_MS)
        checkForMatch()

        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [API_BASE, showWinner])

    // Spawn particles on collision
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

    // Connect to WebSocket when match is found
    useEffect(() => {
        if (!matchId) return

        console.log('[Watch] Connecting to WebSocket for match:', matchId)
        setConnectionStatus('connecting')

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
            console.log('[Watch] WebSocket connected!')
            setConnected(true)
            setConnectionStatus('connected')
        }

        ws.onmessage = (event) => {
            try {
                const data: MatchState = JSON.parse(event.data)
                setMatchState(data)

                // Trigger screen shake and particles on collision
                if (data.collision) {
                    setIsShaking(true)
                    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current)
                    shakeTimeoutRef.current = setTimeout(() => setIsShaking(false), COLLISION_SHAKE_DURATION_MS)

                    // Spawn particles at collision point
                    if (data.p1 && data.p2) {
                        const cx = ((data.p1.x + data.p2.x) / 2 / ENGINE_WIDTH) * RING_SIZE
                        const cy = ((data.p1.y + data.p2.y) / 2 / ENGINE_HEIGHT) * RING_SIZE
                        spawnParticles(cx, cy)
                    }
                }

                // Handle skill events
                if (data.events && data.events.length > 0) {
                    data.events.forEach(evt => {
                        if (evt.type === 'skill') {
                            const side = evt.wrestler_id === data.p1.id ? 'left' : 'right'
                            setActiveSkills(prev => [...prev, { event: evt, side }])

                            setTimeout(() => {
                                setActiveSkills(prev => prev.filter(s => s.event.timestamp !== evt.timestamp))
                            }, SKILL_POPUP_DURATION_MS)
                        }
                    })
                }

                // If game is over, show winner screen
                if (data.game_over && data.winner_name && !showWinner) {
                    const isP1Winner = data.winner === data.p1.id
                    setWinnerData({
                        name: data.winner_name,
                        color: isP1Winner ? data.p1.color : data.p2.color,
                        seed: isP1Winner ? (data.p1.avatar_seed || 0) : (data.p2.avatar_seed || 0)
                    })
                    setShowWinner(true)

                    // Auto-hide winner after delay (but keep polling for new match)
                    winnerTimeoutRef.current = setTimeout(() => {
                        setShowWinner(false)
                        setWinnerData(null)
                        setMatchId(null)
                        setMatchState(null)
                        setConnected(false)
                        setConnectionStatus('idle')
                        currentMatchIdRef.current = null
                    }, GAME_OVER_RESET_DELAY_MS)
                }
            } catch (e) {
                console.error('[Watch] Failed to parse match state:', e)
            }
        }

        ws.onerror = (error) => {
            console.error('[Watch] WebSocket error:', error)
            setConnectionStatus('error')
        }

        ws.onclose = () => {
            console.log('[Watch] WebSocket closed')
            setConnected(false)
        }

        return () => {
            ws.close()
            if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current)
        }
    }, [matchId, spawnParticles, showWinner])

    // Smooth position interpolation
    useEffect(() => {
        if (!matchState) return

        const lerp = (a: number, b: number, t: number) => a + (b - a) * t

        setDisplayP1(prev => {
            if (!prev) return { x: matchState.p1.x, y: matchState.p1.y }
            return {
                x: lerp(prev.x, matchState.p1.x, POSITION_LERP_FACTOR),
                y: lerp(prev.y, matchState.p1.y, POSITION_LERP_FACTOR)
            }
        })

        setDisplayP2(prev => {
            if (!prev) return { x: matchState.p2.x, y: matchState.p2.y }
            return {
                x: lerp(prev.x, matchState.p2.x, POSITION_LERP_FACTOR),
                y: lerp(prev.y, matchState.p2.y, POSITION_LERP_FACTOR)
            }
        })
    }, [matchState])

    const engineToRing = (engineX: number, engineY: number) => ({
        x: (engineX / ENGINE_WIDTH) * RING_SIZE,
        y: (engineY / ENGINE_HEIGHT) * RING_SIZE
    })

    const getWrestlerName = (wrestler: WrestlerState) =>
        wrestler.custom_name || wrestler.name || 'Unknown'

    // Render waiting screen
    if (!matchId || !connected) {
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
            {/* CSS Animations */}
            <style>{`
                @keyframes particle-burst {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(0); opacity: 0; }
                }
                @keyframes skill-popup {
                    0% { transform: translateY(20px) scale(0.8); opacity: 0; }
                    15% { transform: translateY(0) scale(1.1); opacity: 1; }
                    30% { transform: scale(1); }
                    85% { opacity: 1; }
                    100% { transform: translateY(-10px); opacity: 0; }
                }
                @keyframes winner-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
            `}</style>

            {/* Skill Popups - OUTSIDE the ring */}
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
                        <div style={{ fontSize: 16, color: '#ffcc00', marginBottom: 4 }}>
                            {s.event.skill_name}
                        </div>
                        <div style={{ fontSize: 10, color: '#888' }}>
                            {s.event.skill_jp}
                        </div>
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
                        <div style={{ fontSize: 16, color: '#ffcc00', marginBottom: 4 }}>
                            {s.event.skill_name}
                        </div>
                        <div style={{ fontSize: 10, color: '#888' }}>
                            {s.event.skill_jp}
                        </div>
                    </div>
                ))}
            </div>

            {/* Match Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: RING_SIZE,
                marginBottom: 20,
                alignItems: 'center'
            }}>
                <div style={{ textAlign: 'left' }}>
                    <p style={{
                        fontSize: 14,
                        color: `rgb(${matchState?.p1?.color || '255,255,255'})`,
                        textShadow: '2px 2px 0 #000',
                        margin: 0
                    }}>
                        {matchState?.p1 ? getWrestlerName(matchState.p1) : 'P1'}
                    </p>
                </div>
                <span style={{ fontSize: 12, color: '#c9a227' }}>VS</span>
                <div style={{ textAlign: 'right' }}>
                    <p style={{
                        fontSize: 14,
                        color: `rgb(${matchState?.p2?.color || '255,255,255'})`,
                        textShadow: '2px 2px 0 #000',
                        margin: 0
                    }}>
                        {matchState?.p2 ? getWrestlerName(matchState.p2) : 'P2'}
                    </p>
                </div>
            </div>

            {/* Dohyo (Ring) */}
            <div style={{
                width: RING_SIZE,
                height: RING_SIZE,
                borderRadius: '50%',
                border: '8px solid #c9a227',
                background: 'radial-gradient(circle, #d4a574 0%, #a67c52 100%)',
                position: 'relative',
                boxShadow: '0 0 40px rgba(201, 162, 39, 0.3)',
                transform: isShaking ? `translate(${Math.random() * 8 - 4}px, ${Math.random() * 8 - 4}px)` : 'none',
                transition: isShaking ? 'none' : 'transform 0.1s ease-out'
            }}>
                {/* Inner ring line */}
                <div style={{
                    position: 'absolute',
                    top: 20,
                    left: 20,
                    right: 20,
                    bottom: 20,
                    borderRadius: '50%',
                    border: '4px solid #8b4513'
                }} />

                {/* Collision Particles */}
                {particles.map((p, i) => (
                    <ImpactParticle key={p.id} x={p.x} y={p.y} delay={i * 30} />
                ))}

                {/* Wrestler 1 */}
                {matchState?.p1 && p1Pos && (
                    <div style={{
                        position: 'absolute',
                        left: `${p1Pos.x}px`,
                        top: `${p1Pos.y}px`,
                        transform: 'translate(-50%, -50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        <PixelSumo
                            seed={matchState.p1.avatar_seed || 0}
                            color={matchState.p1.color}
                            size={WRESTLER_SPRITE_SIZE}
                        />
                    </div>
                )}

                {/* Wrestler 2 */}
                {matchState?.p2 && p2Pos && (
                    <div style={{
                        position: 'absolute',
                        left: `${p2Pos.x}px`,
                        top: `${p2Pos.y}px`,
                        transform: 'translate(-50%, -50%) scaleX(-1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        <PixelSumo
                            seed={matchState.p2.avatar_seed || 0}
                            color={matchState.p2.color}
                            size={WRESTLER_SPRITE_SIZE}
                        />
                    </div>
                )}
            </div>

            {/* Winner Overlay */}
            {showWinner && winnerData && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.9)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100
                }}>
                    <p style={{ fontSize: 16, color: '#888', marginBottom: 10 }}>勝者</p>
                    <p style={{ fontSize: 24, color: '#ffcc00', marginBottom: 30, textShadow: '2px 2px 0 #000' }}>
                        WINNER
                    </p>

                    <div style={{ marginBottom: 20, animation: 'winner-pulse 1s infinite' }}>
                        <PixelSumo
                            seed={winnerData.seed}
                            color={winnerData.color}
                            size={128}
                        />
                    </div>

                    <p style={{ fontSize: 28, color: '#fff', textShadow: '2px 2px 0 #000' }}>
                        {winnerData.name}
                    </p>
                    <p style={{ fontSize: 10, color: '#666', marginTop: 40 }}>
                        Returning to lobby...
                    </p>
                </div>
            )}
        </div>
    )
}
