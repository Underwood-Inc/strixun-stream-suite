/**
 * Party Room Handlers
 * 
 * Handlers for party room functionality (opt-in room splitting)
 * Allows users to create private sub-rooms within a main room
 * 
 * @module handlers/party
 */

import { getCorsHeaders } from '../utils/cors.js';
import { authenticateRequest } from '../utils/auth.js';
import { generateRoomId } from '../utils/room.js';
import { 
  checkRateLimit, 
  getClientIdentifier, 
  createRateLimitResponse, 
  RATE_LIMITS 
} from '../utils/rate-limit.js';
import { 
  validateRequest, 
  createPartyRoomSchema, 
  inviteToPartyRoomSchema 
} from '../utils/validation.js';
import type { 
  Env, 
  AuthResult, 
  PartyRoomMetadata, 
  CreatePartyRoomRequest, 
  InviteToPartyRoomRequest,
  ErrorResponse,
} from '../types';

/**
 * Create party room (opt-in room splitting)
 * POST /signaling/create-party-room
 * 
 * Creates a private sub-room for select users
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Response with party room metadata
 */
export async function handleCreatePartyRoom(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Authenticate request
    const auth: AuthResult = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      const errorResponse: ErrorResponse = { 
        error: auth.error || 'Unauthorized' 
      };
      return new Response(JSON.stringify(errorResponse), {
        status: auth.status || 401,
        headers: { 
          ...getCorsHeaders(env, request), 
          'Content-Type': 'application/json' 
        },
      });
    }

    // Rate limit check: 5 rooms per hour per user (same as regular rooms)
    const clientId = getClientIdentifier(request, auth.userId);
    const rateLimitKey = `create_party_room_${clientId}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, env, RATE_LIMITS.CREATE_ROOM);
    
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(
        rateLimitResult, 
        getCorsHeaders(env, request),
        RATE_LIMITS.CREATE_ROOM.message
      );
    }

    // Parse and validate request body
    const bodyData = await request.json();
    const validation = validateRequest(bodyData, createPartyRoomSchema);
    
    if (!validation.success) {
      const errorResponse: ErrorResponse = { 
        error: 'Validation failed',
        message: validation.error,
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { 
          ...getCorsHeaders(env, request), 
          'Content-Type': 'application/json' 
        },
      });
    }
    
    const { broadcasterId, broadcasterName, customName, parentRoomId, invitedUsers } = validation.data;

    // Generate room ID and create party room metadata
    const roomId = generateRoomId();
    const room: PartyRoomMetadata = {
      roomId,
      broadcasterId,
      broadcasterName,
      createdAt: new Date().toISOString(),
      participantCount: 1,
      isPublic: true,
      isPartyRoom: true,
      parentRoomId: parentRoomId || undefined,
      createdBy: broadcasterId,
      invitedUsers: invitedUsers || [],
      customName: customName || undefined,
      lastActivity: Date.now(),
    };

    // Store party room in KV with 1 hour TTL
    const roomKey = `chat_room_${roomId}`;
    await env.CHAT_KV.put(roomKey, JSON.stringify(room), { 
      expirationTtl: 3600 
    });

    // If parent room exists, add to parent's party rooms list
    if (parentRoomId) {
      const parentPartyRoomsKey = `chat_party_rooms_${parentRoomId}`;
      const partyRoomsStr = await env.CHAT_KV.get(parentPartyRoomsKey);
      const partyRooms: string[] = partyRoomsStr 
        ? JSON.parse(partyRoomsStr) 
        : [];
      partyRooms.push(roomId);
      await env.CHAT_KV.put(parentPartyRoomsKey, JSON.stringify(partyRooms), { 
        expirationTtl: 3600 
      });
    }

    // Add to active rooms list
    const activeRoomsKey = 'chat_active_rooms';
    const activeRoomsStr = await env.CHAT_KV.get(activeRoomsKey);
    const activeRooms: string[] = activeRoomsStr 
      ? JSON.parse(activeRoomsStr) 
      : [];
    activeRooms.push(roomId);
    await env.CHAT_KV.put(activeRoomsKey, JSON.stringify(activeRooms), { 
      expirationTtl: 3600 
    });

    return new Response(JSON.stringify({
      success: true,
      room,
    }), {
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chat Signaling] Create party room error:', errorMessage);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to create party room',
      message: errorMessage,
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  }
}

/**
 * Get party rooms for a parent room
 * GET /signaling/party-rooms/:parentRoomId
 * 
 * Returns all party rooms associated with a parent room
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns List of party rooms
 */
export async function handleGetPartyRooms(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Extract parent room ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const parentRoomId = pathParts[pathParts.length - 1];

    if (!parentRoomId) {
      const errorResponse: ErrorResponse = { 
        error: 'parentRoomId required' 
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { 
          ...getCorsHeaders(env, request), 
          'Content-Type': 'application/json' 
        },
      });
    }

    // Get party rooms list for parent
    const parentPartyRoomsKey = `chat_party_rooms_${parentRoomId}`;
    const partyRoomIdsStr = await env.CHAT_KV.get(parentPartyRoomsKey);
    const partyRoomIds: string[] = partyRoomIdsStr 
      ? JSON.parse(partyRoomIdsStr) 
      : [];

    // Fetch metadata for each party room
    const rooms: PartyRoomMetadata[] = [];
    const fiveMinutesAgo = Date.now() - 300000;

    for (const roomId of partyRoomIds) {
      const roomKey = `chat_room_${roomId}`;
      const roomStr = await env.CHAT_KV.get(roomKey);
      
      if (roomStr) {
        const room: PartyRoomMetadata = JSON.parse(roomStr);
        // Only include party rooms with recent activity (last 5 minutes)
        if (room.isPartyRoom && room.lastActivity && room.lastActivity > fiveMinutesAgo) {
          rooms.push(room);
        }
      }
    }

    // Sort by most recent activity first
    rooms.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));

    return new Response(JSON.stringify({
      success: true,
      rooms,
    }), {
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chat Signaling] Get party rooms error:', errorMessage);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to get party rooms',
      message: errorMessage,
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  }
}

/**
 * Invite users to party room
 * POST /signaling/party-room/:roomId/invite
 * 
 * Adds users to the invited users list for a party room
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Updated invited users list
 */
export async function handleInviteToPartyRoom(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Authenticate request
    const auth: AuthResult = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      const errorResponse: ErrorResponse = { 
        error: auth.error || 'Unauthorized' 
      };
      return new Response(JSON.stringify(errorResponse), {
        status: auth.status || 401,
        headers: { 
          ...getCorsHeaders(env, request), 
          'Content-Type': 'application/json' 
        },
      });
    }

    // Extract room ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const roomIdIndex = pathParts.findIndex(part => part === 'party-room') + 1;
    const roomId = pathParts[roomIdIndex];

    if (!roomId) {
      const errorResponse: ErrorResponse = { 
        error: 'roomId required' 
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { 
          ...getCorsHeaders(env, request), 
          'Content-Type': 'application/json' 
        },
      });
    }

    // Parse and validate request body
    const bodyData = await request.json();
    const validation = validateRequest(bodyData, inviteToPartyRoomSchema);
    
    if (!validation.success) {
      const errorResponse: ErrorResponse = { 
        error: 'Validation failed',
        message: validation.error,
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { 
          ...getCorsHeaders(env, request), 
          'Content-Type': 'application/json' 
        },
      });
    }
    
    const { userIds } = validation.data;

    // Get room
    const roomKey = `chat_room_${roomId}`;
    const roomStr = await env.CHAT_KV.get(roomKey);

    if (!roomStr) {
      const errorResponse: ErrorResponse = { 
        error: 'Room not found' 
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { 
          ...getCorsHeaders(env, request), 
          'Content-Type': 'application/json' 
        },
      });
    }

    const room: PartyRoomMetadata = JSON.parse(roomStr);

    // Verify user is room creator
    if (room.createdBy !== auth.userId && room.broadcasterId !== auth.userId) {
      const errorResponse: ErrorResponse = { 
        error: 'Only room creator can invite users' 
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: { 
          ...getCorsHeaders(env, request), 
          'Content-Type': 'application/json' 
        },
      });
    }

    // Update invited users list (merge with existing, remove duplicates)
    const existingInvites = room.invitedUsers || [];
    const newInvites = Array.from(new Set([...existingInvites, ...userIds]));
    room.invitedUsers = newInvites;
    room.lastActivity = Date.now();

    // Update room in KV
    await env.CHAT_KV.put(roomKey, JSON.stringify(room), { 
      expirationTtl: 3600 
    });

    return new Response(JSON.stringify({
      success: true,
      invitedUsers: newInvites,
    }), {
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chat Signaling] Invite to party room error:', errorMessage);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to invite users',
      message: errorMessage,
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  }
}
