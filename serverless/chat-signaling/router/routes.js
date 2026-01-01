/**
 * Chat Signaling Router
 * 
 * Routes all requests to appropriate handlers
 * Uses shared encryption suite for automatic response encryption
 */

import { handleHealth } from '../handlers/health.js';
import { handleCreatePartyRoom, handleGetPartyRooms, handleInviteToPartyRoom } from '../handlers/party.js';
import { handleCreateRoom, handleGetAnswer, handleGetOffer, handleGetRooms, handleHeartbeat, handleJoinRoom, handleLeaveRoom, handleSendAnswer, handleSendOffer } from '../handlers/signaling.js';
import { getCorsHeaders } from '../utils/cors.js';
import { wrapWithEncryption as apiWrapWithEncryption } from '@strixun/api-framework';

/**
 * Helper to wrap handlers with automatic encryption
 * CRITICAL: JWT encryption is MANDATORY - uses API framework's wrapWithEncryption
 */
async function wrapWithEncryption(handlerResponse, request, env) {
  // CRITICAL SECURITY: JWT encryption is MANDATORY for all endpoints
  // Get JWT token from request
  const authHeader = request.headers.get('Authorization');
  const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  if (!jwtToken) {
    const errorResponse = {
      type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
      title: 'Unauthorized',
      status: 401,
      detail: 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.',
      instance: request.url
    };
    const corsHeaders = getCorsHeaders(env, request);
    return new Response(JSON.stringify(errorResponse), {
      status: 401,
      headers: {
        'Content-Type': 'application/problem+json',
        ...corsHeaders,
      },
    });
  }

  // Create auth object for encryption
  const authForEncryption = { userId: 'anonymous', customerId: null, jwtToken };

  // Use API framework's wrapWithEncryption which requires JWT by default
  const result = await apiWrapWithEncryption(handlerResponse, authForEncryption, request, env);
  return result.response;
}

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
      const response = await handleCreateRoom(request, env);
      return await wrapWithEncryption(response, request, env);
    }

    if (path === '/signaling/join-room' && request.method === 'POST') {
      const response = await handleJoinRoom(request, env);
      return await wrapWithEncryption(response, request, env);
    }

    if (path === '/signaling/offer' && request.method === 'POST') {
      const response = await handleSendOffer(request, env);
      return await wrapWithEncryption(response, request, env);
    }

    if (path.startsWith('/signaling/offer/') && request.method === 'GET') {
      const response = await handleGetOffer(request, env);
      return await wrapWithEncryption(response, request, env);
    }

    if (path === '/signaling/answer' && request.method === 'POST') {
      const response = await handleSendAnswer(request, env);
      return await wrapWithEncryption(response, request, env);
    }

    if (path.startsWith('/signaling/answer/') && request.method === 'GET') {
      const response = await handleGetAnswer(request, env);
      return await wrapWithEncryption(response, request, env);
    }

    if (path === '/signaling/heartbeat' && request.method === 'POST') {
      const response = await handleHeartbeat(request, env);
      return await wrapWithEncryption(response, request, env);
    }

    if (path === '/signaling/rooms' && request.method === 'GET') {
      const response = await handleGetRooms(request, env);
      return await wrapWithEncryption(response, request, env);
    }

    if (path === '/signaling/leave' && request.method === 'POST') {
      const response = await handleLeaveRoom(request, env);
      return await wrapWithEncryption(response, request, env);
    }

    // Party room endpoints (opt-in room splitting)
    if (path === '/signaling/create-party-room' && request.method === 'POST') {
      const response = await handleCreatePartyRoom(request, env);
      return await wrapWithEncryption(response, request, env);
    }

    if (path.startsWith('/signaling/party-rooms/') && request.method === 'GET') {
      const response = await handleGetPartyRooms(request, env);
      return await wrapWithEncryption(response, request, env);
    }

    if (path.startsWith('/signaling/party-room/') && path.endsWith('/invite') && request.method === 'POST') {
      const response = await handleInviteToPartyRoom(request, env);
      return await wrapWithEncryption(response, request, env);
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

