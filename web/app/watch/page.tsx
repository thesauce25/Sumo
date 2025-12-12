'use client'

import { useEffect, useState, useRef } from 'react'

// 8-bit inspired font
const PIXEL_FONT = "'Press Start 2P', 'Courier New', monospace"

interface MatchState {
    p1: { x: number; y: number; name: string; color: string; health?: number }
    p2: { x: number; y: number; name: string; color: string; health?: number }
    game_over: boolean
    winner?: string
    timestamp: number
}

export default function WatchPage() {
    const [connected, setConnected] = useState(false)
    const [matchId, setMatchId] = useState<string | null>(null)
    const [matchState, setMatchState] = useState<MatchState | null>(null)
    const [waitingDots, setWaitingDots] = useState('')
    const wsRef = useRef<WebSocket | null>(null)
    const pollRef = useRef<NodeJS.Timeout | null>(null)

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://sumo-server-1056239062336.us-central1.run.app/api'
    const WS_BASE = API_BASE.replace('https://', 'wss://').replace('http://', 'ws://').replace('/api', '')

    // Animate waiting dots
    useEffect(() => {
        const interval = setInterval(() => {
            setWaitingDots(prev => (prev.length >= 3 ? '' : prev + '.'))
        }, 500)
        return () => clearInterval(interval)
    }, [])

    // Poll for active matches
    useEffect(() => {
        const checkForMatch = async () => {
            try {
                const res = await fetch(`${API_BASE}/matches/active`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.match_id) {
                        setMatchId(data.match_id)
                    }
                }
            } catch {
                // Backend might not have this endpoint yet, silently fail
            }
        }

        // Poll every 2 seconds if no match
        if (!matchId) {
            pollRef.current = setInterval(checkForMatch, 2000)
            checkForMatch() // Initial check
        }

        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [matchId, API_BASE])

    // Connect to WebSocket when match is found
    useEffect(() => {
        if (!matchId) return

        const ws = new WebSocket(`${WS_BASE}/ws/${matchId}`)
        wsRef.current = ws

        ws.onopen = () => {
            setConnected(true)
            if (pollRef.current) clearInterval(pollRef.current)
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                setMatchState(data)

                // If game is over, reset after delay
                if (data.game_over) {
                    setTimeout(() => {
                        setMatchId(null)
                        setMatchState(null)
                        setConnected(false)
                    }, 5000)
                }
            } catch {
                console.error('Failed to parse match state')
            }
        }

        ws.onclose = () => {
            setConnected(false)
            setMatchId(null)
            setMatchState(null)
        }

        return () => {
            ws.close()
        }
    }, [matchId, WS_BASE])

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
                {/* Decorative ring */}
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
                    {/* Pixelated Dohyo SVG */}
                    <svg width="80" height="80" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' }}>
                        {/* Outer ring (tawara - straw bales) */}
                        <circle cx="16" cy="16" r="14" fill="none" stroke="#f5deb3" strokeWidth="3" />
                        <circle cx="16" cy="16" r="14" fill="none" stroke="#d4a574" strokeWidth="1" />
                        {/* Clay surface */}
                        <circle cx="16" cy="16" r="11" fill="#c9a05c" />
                        {/* Inner ring border */}
                        <circle cx="16" cy="16" r="10" fill="none" stroke="#8b4513" strokeWidth="1" />
                        {/* Center shikiri lines */}
                        <rect x="10" y="15" width="4" height="2" fill="#8b4513" />
                        <rect x="18" y="15" width="4" height="2" fill="#8b4513" />
                        {/* Corner pixels for 8-bit effect */}
                        <rect x="7" y="7" width="2" height="2" fill="#d4a574" opacity="0.5" />
                        <rect x="23" y="7" width="2" height="2" fill="#d4a574" opacity="0.5" />
                        <rect x="7" y="23" width="2" height="2" fill="#d4a574" opacity="0.5" />
                        <rect x="23" y="23" width="2" height="2" fill="#d4a574" opacity="0.5" />
                    </svg>
                </div>

                <h1 style={{
                    fontSize: 24,
                    marginBottom: 20,
                    textShadow: '2px 2px 0 #000'
                }}>
                    大相撲
                </h1>

                <p style={{
                    fontSize: 14,
                    color: '#aaa',
                    marginBottom: 10
                }}>
                    SUMO SMASH
                </p>

                <p style={{
                    fontSize: 12,
                    color: '#ffcc00',
                    minWidth: 200
                }}>
                    WAITING FOR MATCH{waitingDots}
                </p>

                <p style={{
                    fontSize: 10,
                    color: '#666',
                    marginTop: 40,
                    maxWidth: 400
                }}>
                    This screen will automatically connect when a match starts from the Controller app.
                </p>
            </div>
        )
    }

    // Render match view
    const RING_SIZE = 300
    const RING_RADIUS = RING_SIZE / 2 - 20

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
            padding: 20
        }}>
            {/* Match ID */}
            <p style={{ fontSize: 10, color: '#666', marginBottom: 10 }}>
                MATCH: {matchId}
            </p>

            {/* Dohyo (Ring) */}
            <div style={{
                width: RING_SIZE,
                height: RING_SIZE,
                borderRadius: '50%',
                border: '8px solid #c9a227',
                background: 'radial-gradient(circle, #d4a574 0%, #a67c52 100%)',
                position: 'relative',
                boxShadow: '0 0 40px rgba(201, 162, 39, 0.3)'
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

                {/* Player 1 */}
                {matchState?.p1 && (
                    <div style={{
                        position: 'absolute',
                        left: `${(matchState.p1.x / 32) * RING_SIZE}px`,
                        top: `${(matchState.p1.y / 32) * RING_SIZE}px`,
                        transform: 'translate(-50%, -50%)',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: `rgb(${matchState.p1.color})`,
                        border: '3px solid #fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                    }}>
                        1
                    </div>
                )}

                {/* Player 2 */}
                {matchState?.p2 && (
                    <div style={{
                        position: 'absolute',
                        left: `${(matchState.p2.x / 32) * RING_SIZE}px`,
                        top: `${(matchState.p2.y / 32) * RING_SIZE}px`,
                        transform: 'translate(-50%, -50%)',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: `rgb(${matchState.p2.color})`,
                        border: '3px solid #fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                    }}>
                        2
                    </div>
                )}
            </div>

            {/* Player Names */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: RING_SIZE,
                marginTop: 20
            }}>
                <span style={{ fontSize: 12, color: `rgb(${matchState?.p1?.color || '255,255,255'})` }}>
                    {matchState?.p1?.name || 'P1'}
                </span>
                <span style={{ fontSize: 10, color: '#888' }}>VS</span>
                <span style={{ fontSize: 12, color: `rgb(${matchState?.p2?.color || '255,255,255'})` }}>
                    {matchState?.p2?.name || 'P2'}
                </span>
            </div>

            {/* Winner Overlay */}
            {matchState?.game_over && matchState?.winner && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100
                }}>
                    <p style={{ fontSize: 16, color: '#ffcc00', marginBottom: 10 }}>勝者</p>
                    <p style={{ fontSize: 24, color: '#fff' }}>{matchState.winner}</p>
                    <p style={{ fontSize: 10, color: '#666', marginTop: 20 }}>Returning to lobby...</p>
                </div>
            )}
        </div>
    )
}
