/**
 * Strixun Chat Signaling Server
 * 
 * Minimal Cloudflare Worker for WebRTC signaling
 * Handles only initial connection setup - all messages go P2P after that
 * 
 * @version 1.0.0
 */

/**
 * Get CORS headers with dynamic origin whitelist
 * @param {*} env - Worker environment
 * @param {Request} request - Request object
 * @returns {Object} CORS headers
 */
function getCorsHeaders(env, request) {
  const origin = request.headers.get('Origin');
  
  // Get allowed origins from environment (comma-separated)
  const allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [];
  
  // If no origins configured, allow all (for development only)
  // In production, you MUST set ALLOWED_ORIGINS via: wrangler secret put ALLOWED_ORIGINS
  const allowOrigin = allowedOrigins.length > 0 
      ? (origin && allowedOrigins.includes(origin) ? origin : null)
      : '*'; // Fallback for development
  
  return {
      'Access-Control-Allow-Origin': allowOrigin || 'null',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-ID, X-Requested-With, X-CSRF-Token',
      'Access-Control-Allow-Credentials': allowOrigin !== '*' ? 'true' : 'false',
      'Access-Control-Max-Age': '86400',
      // Security headers
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  };
}

/**
 * Hash email for storage key
 */
async function hashEmail(email) {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify JWT token
 */
async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const signatureInput = `${headerB64}.${payloadB64}`;
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(signatureInput)
    );

    if (!isValid) return null;

    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    );

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Get JWT secret from environment
 * @param {*} env - Worker environment
 * @returns {string} JWT secret
 * @throws {Error} If JWT_SECRET is not set
 */
function getJWTSecret(env) {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Set it via: wrangler secret put JWT_SECRET. IMPORTANT: Use the SAME secret as your main API worker.');
  }
  return env.JWT_SECRET;
}

/**
 * Authenticate request
 */
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, status: 401, error: 'Authorization header required' };
  }

  const token = authHeader.substring(7);
  const jwtSecret = getJWTSecret(env);
  const payload = await verifyJWT(token, jwtSecret);

  if (!payload) {
    return { authenticated: false, status: 401, error: 'Invalid or expired token' };
  }

  return {
    authenticated: true,
    userId: payload.userId,
    email: payload.email,
  };
}

/**
 * Generate room ID
 */
function generateRoomId() {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create room
 * POST /signaling/create-room
 */
async function handleCreateRoom(request, env) {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { broadcasterId, broadcasterName, customName } = body;

    if (!broadcasterId || !broadcasterName) {
      return new Response(JSON.stringify({ error: 'broadcasterId and broadcasterName required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const roomId = generateRoomId();
    const room = {
      roomId,
      broadcasterId,
      broadcasterName,
      createdAt: new Date().toISOString(),
      participantCount: 1,
      isPublic: true,
      customName: customName || null,
      lastActivity: Date.now(),
    };

    // Store room in KV
    const roomKey = `chat_room_${roomId}`;
    await env.CHAT_KV.put(roomKey, JSON.stringify(room), { expirationTtl: 3600 }); // 1 hour TTL

    // Add to active rooms list
    const activeRoomsKey = 'chat_active_rooms';
    const activeRooms = await env.CHAT_KV.get(activeRoomsKey, { type: 'json' }) || [];
    activeRooms.push(roomId);
    await env.CHAT_KV.put(activeRoomsKey, JSON.stringify(activeRooms), { expirationTtl: 3600 });

    return new Response(JSON.stringify({
      success: true,
      room,
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to create room',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Join room
 * POST /signaling/join-room
 */
async function handleJoinRoom(request, env) {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { roomId, userId, userName } = body;

    if (!roomId) {
      return new Response(JSON.stringify({ error: 'roomId required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // Get room from KV
    const roomKey = `chat_room_${roomId}`;
    const roomStr = await env.CHAT_KV.get(roomKey);

    if (!roomStr) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const room = JSON.parse(roomStr);
    room.participantCount = (room.participantCount || 1) + 1;
    room.lastActivity = Date.now();

    // Update room
    await env.CHAT_KV.put(roomKey, JSON.stringify(room), { expirationTtl: 3600 });

    return new Response(JSON.stringify({
      success: true,
      room,
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to join room',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Send offer
 * POST /signaling/offer
 */
async function handleSendOffer(request, env) {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { roomId, offer, type, fromUserId } = body;

    if (!roomId || !offer || !type) {
      return new Response(JSON.stringify({ error: 'roomId, offer, and type required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // Store offer temporarily (30 second TTL)
    const offerKey = `chat_offer_${roomId}`;
    await env.CHAT_KV.put(offerKey, JSON.stringify({
      roomId,
      offer,
      type,
      fromUserId: fromUserId || auth.userId,
      timestamp: Date.now(),
    }), { expirationTtl: 30 });

    return new Response(JSON.stringify({
      success: true,
      message: 'Offer stored',
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to send offer',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get offer
 * GET /signaling/offer/:roomId
 */
async function handleGetOffer(request, env) {
  try {
    const url = new URL(request.url);
    const roomId = url.pathname.split('/').pop();

    if (!roomId) {
      return new Response(JSON.stringify({ error: 'roomId required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const offerKey = `chat_offer_${roomId}`;
    const offerStr = await env.CHAT_KV.get(offerKey);

    if (!offerStr) {
      return new Response(JSON.stringify({ error: 'Offer not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const offerData = JSON.parse(offerStr);

    // Delete offer after retrieval (single-use)
    await env.CHAT_KV.delete(offerKey);

    return new Response(JSON.stringify({
      success: true,
      offer: offerData.offer,
      type: offerData.type,
      fromUserId: offerData.fromUserId,
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get offer',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Send answer
 * POST /signaling/answer
 */
async function handleSendAnswer(request, env) {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { roomId, answer, type, fromUserId } = body;

    if (!roomId || !answer || !type) {
      return new Response(JSON.stringify({ error: 'roomId, answer, and type required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // Store answer temporarily (30 second TTL)
    const answerKey = `chat_answer_${roomId}`;
    await env.CHAT_KV.put(answerKey, JSON.stringify({
      roomId,
      answer,
      type,
      fromUserId: fromUserId || auth.userId,
      timestamp: Date.now(),
    }), { expirationTtl: 30 });

    return new Response(JSON.stringify({
      success: true,
      message: 'Answer stored',
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to send answer',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get answer
 * GET /signaling/answer/:roomId
 */
async function handleGetAnswer(request, env) {
  try {
    const url = new URL(request.url);
    const roomId = url.pathname.split('/').pop();

    if (!roomId) {
      return new Response(JSON.stringify({ error: 'roomId required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const answerKey = `chat_answer_${roomId}`;
    const answerStr = await env.CHAT_KV.get(answerKey);

    if (!answerStr) {
      return new Response(JSON.stringify({ error: 'Answer not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const answerData = JSON.parse(answerStr);

    // Delete answer after retrieval (single-use)
    await env.CHAT_KV.delete(answerKey);

    return new Response(JSON.stringify({
      success: true,
      answer: answerData.answer,
      type: answerData.type,
      fromUserId: answerData.fromUserId,
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get answer',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Send heartbeat
 * POST /signaling/heartbeat
 */
async function handleHeartbeat(request, env) {
  try {
    const body = await request.json();
    const { roomId } = body;

    if (!roomId) {
      return new Response(JSON.stringify({ error: 'roomId required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // Update room activity
    const roomKey = `chat_room_${roomId}`;
    const roomStr = await env.CHAT_KV.get(roomKey);

    if (roomStr) {
      const room = JSON.parse(roomStr);
      room.lastActivity = Date.now();
      await env.CHAT_KV.put(roomKey, JSON.stringify(room), { expirationTtl: 3600 });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Heartbeat received',
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to send heartbeat',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get active rooms
 * GET /signaling/rooms
 */
async function handleGetRooms(request, env) {
  try {
    const activeRoomsKey = 'chat_active_rooms';
    const activeRooms = await env.CHAT_KV.get(activeRoomsKey, { type: 'json' }) || [];

    // Filter out expired rooms and get metadata
    const rooms = [];
    const validRoomIds = [];

    for (const roomId of activeRooms) {
      const roomKey = `chat_room_${roomId}`;
      const roomStr = await env.CHAT_KV.get(roomKey);

      if (roomStr) {
        const room = JSON.parse(roomStr);
        // Only include public rooms with recent activity
        if (room.isPublic && Date.now() - room.lastActivity < 300000) { // 5 minutes
          rooms.push(room);
          validRoomIds.push(roomId);
        }
      }
    }

    // Update active rooms list (remove expired)
    await env.CHAT_KV.put(activeRoomsKey, JSON.stringify(validRoomIds), { expirationTtl: 3600 });

    return new Response(JSON.stringify({
      success: true,
      rooms: rooms.sort((a, b) => b.lastActivity - a.lastActivity), // Most recent first
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get rooms',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Leave room
 * POST /signaling/leave
 */
async function handleLeaveRoom(request, env) {
  try {
    const body = await request.json();
    const { roomId, userId } = body;

    if (!roomId) {
      return new Response(JSON.stringify({ error: 'roomId required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // Update room participant count
    const roomKey = `chat_room_${roomId}`;
    const roomStr = await env.CHAT_KV.get(roomKey);

    if (roomStr) {
      const room = JSON.parse(roomStr);
      room.participantCount = Math.max(0, (room.participantCount || 1) - 1);

      // If no participants, remove from active rooms
      if (room.participantCount === 0) {
        const activeRoomsKey = 'chat_active_rooms';
        const activeRooms = await env.CHAT_KV.get(activeRoomsKey, { type: 'json' }) || [];
        const filtered = activeRooms.filter(id => id !== roomId);
        await env.CHAT_KV.put(activeRoomsKey, JSON.stringify(filtered), { expirationTtl: 3600 });
      } else {
        await env.CHAT_KV.put(roomKey, JSON.stringify(room), { expirationTtl: 3600 });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Left room',
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to leave room',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Health check
 * GET /health
 */
async function handleHealth() {
  return new Response(JSON.stringify({
    status: 'ok',
    service: 'chat-signaling',
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders(env, request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/health' || path === '/') {
        return handleHealth();
      }

      // Signaling endpoints
      if (path === '/signaling/create-room' && request.method === 'POST') {
        return handleCreateRoom(request, env);
      }

      if (path === '/signaling/join-room' && request.method === 'POST') {
        return handleJoinRoom(request, env);
      }

      if (path === '/signaling/offer' && request.method === 'POST') {
        return handleSendOffer(request, env);
      }

      if (path.startsWith('/signaling/offer/') && request.method === 'GET') {
        return handleGetOffer(request, env);
      }

      if (path === '/signaling/answer' && request.method === 'POST') {
        return handleSendAnswer(request, env);
      }

      if (path.startsWith('/signaling/answer/') && request.method === 'GET') {
        return handleGetAnswer(request, env);
      }

      if (path === '/signaling/heartbeat' && request.method === 'POST') {
        return handleHeartbeat(request, env);
      }

      if (path === '/signaling/rooms' && request.method === 'GET') {
        return handleGetRooms(request, env);
      }

      if (path === '/signaling/leave' && request.method === 'POST') {
        return handleLeaveRoom(request, env);
      }

      // Not found
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }), {
        status: 500,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }
  },
};

