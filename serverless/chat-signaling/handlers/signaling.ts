/**
 * Signaling Handlers
 * 
 * WebRTC signaling handlers for P2P chat
 * Handles room creation, joining, offer/answer exchange, and heartbeats
 * 
 * @module handlers/signaling
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
  createRoomSchema, 
  joinRoomSchema, 
  sendOfferSchema, 
  sendAnswerSchema, 
  heartbeatSchema, 
  leaveRoomSchema 
} from '../utils/validation.js';
import type { 
  Env, 
  AuthResult, 
  RoomMetadata, 
  CreateRoomRequest, 
  JoinRoomRequest, 
  SendOfferRequest, 
  SendAnswerRequest, 
  HeartbeatRequest, 
  LeaveRoomRequest,
  ErrorResponse,
} from '../types';

/**
 * Create room
 * POST /signaling/create-room
 * 
 * Creates a new chat room with the broadcaster as the owner
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Response with room metadata
 */
export async function handleCreateRoom(
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

    // Rate limit check: 5 rooms per hour per user
    const clientId = getClientIdentifier(request, auth.userId);
    const rateLimitKey = `create_room_${clientId}`;
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
    const validation = validateRequest(bodyData, createRoomSchema);
    
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
    
    const { broadcasterId, broadcasterName, customName, encryptedRoomKey, keyHash } = validation.data;

    // Generate room ID and create room metadata
    const roomId = generateRoomId();
    const room: RoomMetadata = {
      roomId,
      broadcasterId,
      broadcasterName,
      createdAt: new Date().toISOString(),
      participantCount: 1,
      isPublic: true,
      customName: customName || undefined,
      lastActivity: Date.now(),
      // P2P E2E encryption support
      encryptedRoomKey: encryptedRoomKey || undefined,
      keyHash: keyHash || undefined,
      keyVersion: encryptedRoomKey ? 1 : undefined,
    };

    // Store room in KV with 1 hour TTL
    const roomKey = `chat_room_${roomId}`;
    await env.CHAT_KV.put(roomKey, JSON.stringify(room), { 
      expirationTtl: 3600 
    });

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
    console.error('[Chat Signaling] Create room error:', errorMessage);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to create room',
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
 * Join room
 * POST /signaling/join-room
 * 
 * Allows a user to join an existing room
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Response with room metadata
 */
export async function handleJoinRoom(
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

    // Rate limit check: 20 joins per hour per user
    const clientId = getClientIdentifier(request, auth.userId);
    const rateLimitKey = `join_room_${clientId}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, env, RATE_LIMITS.JOIN_ROOM);
    
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(
        rateLimitResult, 
        getCorsHeaders(env, request),
        RATE_LIMITS.JOIN_ROOM.message
      );
    }

    // Parse and validate request body
    const bodyData = await request.json();
    const validation = validateRequest(bodyData, joinRoomSchema);
    
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
    
    const { roomId } = validation.data;

    // Get room from KV
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

    // Parse and update room
    const room: RoomMetadata = JSON.parse(roomStr);
    room.participantCount = (room.participantCount || 1) + 1;
    room.lastActivity = Date.now();

    // Update room in KV
    await env.CHAT_KV.put(roomKey, JSON.stringify(room), { 
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
    console.error('[Chat Signaling] Join room error:', errorMessage);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to join room',
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
 * Send offer
 * POST /signaling/offer
 * 
 * Stores a WebRTC offer temporarily for retrieval by peer
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Success response
 */
export async function handleSendOffer(
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

    // Rate limit check: 50 offer/answer exchanges per hour per user
    const clientId = getClientIdentifier(request, auth.userId);
    const rateLimitKey = `offer_${clientId}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, env, RATE_LIMITS.OFFER_ANSWER);
    
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(
        rateLimitResult, 
        getCorsHeaders(env, request),
        RATE_LIMITS.OFFER_ANSWER.message
      );
    }

    // Parse and validate request body
    const bodyData = await request.json();
    const validation = validateRequest(bodyData, sendOfferSchema);
    
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
    
    const { roomId, offer, type, fromUserId } = validation.data;

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
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chat Signaling] Send offer error:', errorMessage);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to send offer',
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
 * Get offer
 * GET /signaling/offer/:roomId
 * 
 * Retrieves a stored WebRTC offer (single-use, deleted after retrieval)
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Offer data or 404 if not found
 */
export async function handleGetOffer(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Extract room ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const roomId = pathParts[pathParts.length - 1];

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

    // Get offer from KV
    const offerKey = `chat_offer_${roomId}`;
    const offerStr = await env.CHAT_KV.get(offerKey);

    if (!offerStr) {
      const errorResponse: ErrorResponse = { 
        error: 'Offer not found' 
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { 
          ...getCorsHeaders(env, request), 
          'Content-Type': 'application/json' 
        },
      });
    }

    // Parse offer data
    const offerData: {
      offer: string;
      type: string;
      fromUserId?: string;
    } = JSON.parse(offerStr);

    // Delete offer after retrieval (single-use)
    await env.CHAT_KV.delete(offerKey);

    return new Response(JSON.stringify({
      success: true,
      offer: offerData.offer,
      type: offerData.type,
      fromUserId: offerData.fromUserId,
    }), {
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chat Signaling] Get offer error:', errorMessage);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to get offer',
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
 * Send answer
 * POST /signaling/answer
 * 
 * Stores a WebRTC answer temporarily for retrieval by peer
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Success response
 */
export async function handleSendAnswer(
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

    // Parse and validate request body
    const bodyData = await request.json();
    const validation = validateRequest(bodyData, sendAnswerSchema);
    
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
    
    const { roomId, answer, type, fromUserId } = validation.data;

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
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chat Signaling] Send answer error:', errorMessage);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to send answer',
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
 * Get answer
 * GET /signaling/answer/:roomId
 * 
 * Retrieves a stored WebRTC answer (single-use, deleted after retrieval)
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Answer data or 404 if not found
 */
export async function handleGetAnswer(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Extract room ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const roomId = pathParts[pathParts.length - 1];

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

    // Get answer from KV
    const answerKey = `chat_answer_${roomId}`;
    const answerStr = await env.CHAT_KV.get(answerKey);

    if (!answerStr) {
      const errorResponse: ErrorResponse = { 
        error: 'Answer not found' 
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { 
          ...getCorsHeaders(env, request), 
          'Content-Type': 'application/json' 
        },
      });
    }

    // Parse answer data
    const answerData: {
      answer: string;
      type: string;
      fromUserId?: string;
    } = JSON.parse(answerStr);

    // Delete answer after retrieval (single-use)
    await env.CHAT_KV.delete(answerKey);

    return new Response(JSON.stringify({
      success: true,
      answer: answerData.answer,
      type: answerData.type,
      fromUserId: answerData.fromUserId,
    }), {
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chat Signaling] Get answer error:', errorMessage);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to get answer',
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
 * Send heartbeat
 * POST /signaling/heartbeat
 * 
 * Updates room activity timestamp to keep it alive
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Success response
 */
export async function handleHeartbeat(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Parse and validate request body
    const bodyData = await request.json();
    const validation = validateRequest(bodyData, heartbeatSchema);
    
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
    
    const { roomId } = validation.data;

    // Rate limit check: 100 heartbeats per hour per room
    const rateLimitKey = `heartbeat_${roomId}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, env, RATE_LIMITS.HEARTBEAT);
    
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(
        rateLimitResult, 
        getCorsHeaders(env, request),
        RATE_LIMITS.HEARTBEAT.message
      );
    }

    // Update room activity
    const roomKey = `chat_room_${roomId}`;
    const roomStr = await env.CHAT_KV.get(roomKey);

    if (roomStr) {
      const room: RoomMetadata = JSON.parse(roomStr);
      room.lastActivity = Date.now();
      await env.CHAT_KV.put(roomKey, JSON.stringify(room), { 
        expirationTtl: 3600 
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Heartbeat received',
    }), {
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chat Signaling] Heartbeat error:', errorMessage);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to send heartbeat',
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
 * Get active rooms
 * GET /signaling/rooms
 * 
 * Returns list of active public rooms with recent activity
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns List of active rooms
 */
export async function handleGetRooms(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const activeRoomsKey = 'chat_active_rooms';
    const activeRoomsStr = await env.CHAT_KV.get(activeRoomsKey);
    const activeRooms: string[] = activeRoomsStr 
      ? JSON.parse(activeRoomsStr) 
      : [];

    // Filter out expired rooms and get metadata
    const rooms: RoomMetadata[] = [];
    const validRoomIds: string[] = [];

    for (const roomId of activeRooms) {
      const roomKey = `chat_room_${roomId}`;
      const roomStr = await env.CHAT_KV.get(roomKey);

      if (roomStr) {
        const room: RoomMetadata = JSON.parse(roomStr);
        // Only include public rooms with recent activity (last 5 minutes)
        const fiveMinutesAgo = Date.now() - 300000;
        if (room.isPublic && room.lastActivity && room.lastActivity > fiveMinutesAgo) {
          rooms.push(room);
          validRoomIds.push(roomId);
        }
      }
    }

    // Update active rooms list (remove expired)
    await env.CHAT_KV.put(activeRoomsKey, JSON.stringify(validRoomIds), { 
      expirationTtl: 3600 
    });

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
    console.error('[Chat Signaling] Get rooms error:', errorMessage);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to get rooms',
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
 * Leave room
 * POST /signaling/leave
 * 
 * Decrements participant count and removes room if empty
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Success response
 */
export async function handleLeaveRoom(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Parse and validate request body
    const bodyData = await request.json();
    const validation = validateRequest(bodyData, leaveRoomSchema);
    
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
    
    const { roomId } = validation.data;

    // Update room participant count
    const roomKey = `chat_room_${roomId}`;
    const roomStr = await env.CHAT_KV.get(roomKey);

    if (roomStr) {
      const room: RoomMetadata = JSON.parse(roomStr);
      room.participantCount = Math.max(0, (room.participantCount || 1) - 1);

      // If no participants, remove from active rooms
      if (room.participantCount === 0) {
        const activeRoomsKey = 'chat_active_rooms';
        const activeRoomsStr = await env.CHAT_KV.get(activeRoomsKey);
        const activeRooms: string[] = activeRoomsStr 
          ? JSON.parse(activeRoomsStr) 
          : [];
        const filtered = activeRooms.filter(id => id !== roomId);
        await env.CHAT_KV.put(activeRoomsKey, JSON.stringify(filtered), { 
          expirationTtl: 3600 
        });
      } else {
        await env.CHAT_KV.put(roomKey, JSON.stringify(room), { 
          expirationTtl: 3600 
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Left room',
    }), {
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chat Signaling] Leave room error:', errorMessage);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to leave room',
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
