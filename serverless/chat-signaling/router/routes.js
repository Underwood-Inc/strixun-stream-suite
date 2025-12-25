/**
 * Chat Signaling Router
 * 
 * Routes all requests to appropriate handlers
 */

import { getCorsHeaders } from '../utils/cors.js';
import { handleCreateRoom, handleJoinRoom, handleSendOffer, handleGetOffer, handleSendAnswer, handleGetAnswer, handleHeartbeat, handleGetRooms, handleLeaveRoom } from '../handlers/signaling.js';
import { handleCreatePartyRoom, handleGetPartyRooms, handleInviteToPartyRoom } from '../handlers/party.js';
import { handleHealth } from '../handlers/health.js';

/**
 * Route requests to appropriate handlers
 */
export async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Health check
    if (path === '/health' || path === '/') {
      return handleHealth(request, env);
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

    // Party room endpoints (opt-in room splitting)
    if (path === '/signaling/create-party-room' && request.method === 'POST') {
      return handleCreatePartyRoom(request, env);
    }

    if (path.startsWith('/signaling/party-rooms/') && request.method === 'GET') {
      return handleGetPartyRooms(request, env);
    }

    if (path.startsWith('/signaling/party-room/') && path.endsWith('/invite') && request.method === 'POST') {
      return handleInviteToPartyRoom(request, env);
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
}

