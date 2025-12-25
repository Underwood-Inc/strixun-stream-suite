/**
 * Signaling Handlers
 * 
 * WebRTC signaling handlers for chat
 */

import { getCorsHeaders } from '../utils/cors.js';
import { authenticateRequest } from '../utils/auth.js';
import { generateRoomId } from '../utils/room.js';

/**
 * Create room
 * POST /signaling/create-room
 */
export async function handleCreateRoom(request, env) {
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
export async function handleJoinRoom(request, env) {
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
export async function handleSendOffer(request, env) {
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
export async function handleGetOffer(request, env) {
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
export async function handleSendAnswer(request, env) {
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
export async function handleGetAnswer(request, env) {
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
export async function handleHeartbeat(request, env) {
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
export async function handleGetRooms(request, env) {
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
export async function handleLeaveRoom(request, env) {
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

