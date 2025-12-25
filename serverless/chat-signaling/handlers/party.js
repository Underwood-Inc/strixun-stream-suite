/**
 * Party Room Handlers
 * 
 * Handlers for party room functionality (opt-in room splitting)
 */

import { getCorsHeaders } from '../utils/cors.js';
import { authenticateRequest } from '../utils/auth.js';
import { generateRoomId } from '../utils/room.js';

/**
 * Create party room (opt-in room splitting)
 * POST /signaling/create-party-room
 */
export async function handleCreatePartyRoom(request, env) {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { broadcasterId, broadcasterName, customName, parentRoomId, invitedUsers } = body;

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
      isPartyRoom: true,
      parentRoomId: parentRoomId || null,
      createdBy: broadcasterId,
      invitedUsers: invitedUsers || [],
      customName: customName || null,
      lastActivity: Date.now(),
    };

    // Store party room in KV
    const roomKey = `chat_room_${roomId}`;
    await env.CHAT_KV.put(roomKey, JSON.stringify(room), { expirationTtl: 3600 }); // 1 hour TTL

    // If parent room exists, add to parent's party rooms list
    if (parentRoomId) {
      const parentPartyRoomsKey = `chat_party_rooms_${parentRoomId}`;
      const partyRooms = await env.CHAT_KV.get(parentPartyRoomsKey, { type: 'json' }) || [];
      partyRooms.push(roomId);
      await env.CHAT_KV.put(parentPartyRoomsKey, JSON.stringify(partyRooms), { expirationTtl: 3600 });
    }

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
      error: 'Failed to create party room',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get party rooms for a parent room
 * GET /signaling/party-rooms/:parentRoomId
 */
export async function handleGetPartyRooms(request, env) {
  try {
    const url = new URL(request.url);
    const parentRoomId = url.pathname.split('/').pop();

    if (!parentRoomId) {
      return new Response(JSON.stringify({ error: 'parentRoomId required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const parentPartyRoomsKey = `chat_party_rooms_${parentRoomId}`;
    const partyRoomIds = await env.CHAT_KV.get(parentPartyRoomsKey, { type: 'json' }) || [];

    const rooms = [];
    for (const roomId of partyRoomIds) {
      const roomKey = `chat_room_${roomId}`;
      const roomStr = await env.CHAT_KV.get(roomKey);
      if (roomStr) {
        const room = JSON.parse(roomStr);
        if (room.isPartyRoom && Date.now() - room.lastActivity < 300000) { // 5 minutes
          rooms.push(room);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      rooms: rooms.sort((a, b) => b.lastActivity - a.lastActivity),
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get party rooms',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Invite users to party room
 * POST /signaling/party-room/:roomId/invite
 */
export async function handleInviteToPartyRoom(request, env) {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const roomId = url.pathname.split('/')[3]; // /signaling/party-room/{roomId}/invite

    if (!roomId) {
      return new Response(JSON.stringify({ error: 'roomId required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds)) {
      return new Response(JSON.stringify({ error: 'userIds array required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // Get room
    const roomKey = `chat_room_${roomId}`;
    const roomStr = await env.CHAT_KV.get(roomKey);

    if (!roomStr) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const room = JSON.parse(roomStr);

    // Verify user is room creator
    if (room.createdBy !== auth.userId && room.broadcasterId !== auth.userId) {
      return new Response(JSON.stringify({ error: 'Only room creator can invite users' }), {
        status: 403,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // Update invited users list
    const existingInvites = room.invitedUsers || [];
    const newInvites = [...new Set([...existingInvites, ...userIds])];
    room.invitedUsers = newInvites;
    room.lastActivity = Date.now();

    await env.CHAT_KV.put(roomKey, JSON.stringify(room), { expirationTtl: 3600 });

    return new Response(JSON.stringify({
      success: true,
      invitedUsers: newInvites,
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to invite users',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

