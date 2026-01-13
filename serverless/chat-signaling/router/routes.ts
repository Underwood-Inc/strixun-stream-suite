/**
 * Chat Signaling Router
 * 
 * Routes all requests to appropriate handlers with automatic response encryption
 * Uses shared encryption suite for JWT-based encryption
 * 
 * @module router/routes
 */

import { wrapWithEncryption } from '@strixun/api-framework';
import { handleHealth } from '../handlers/health.js';
import { 
  handleCreatePartyRoom, 
  handleGetPartyRooms, 
  handleInviteToPartyRoom 
} from '../handlers/party.js';
import { 
  handleCreateRoom, 
  handleGetAnswer, 
  handleGetOffer, 
  handleGetRooms, 
  handleHeartbeat, 
  handleJoinRoom, 
  handleLeaveRoom, 
  handleSendAnswer, 
  handleSendOffer 
} from '../handlers/signaling.js';
import { getCorsHeaders } from '../utils/cors.js';
import { authenticateRequest } from '../utils/auth.js';
import type { Env, AuthResult, ErrorResponse } from '../types';

/**
 * Wrap handler response with JWT encryption
 * 
 * CRITICAL: JWT encryption is MANDATORY for all endpoints
 * Uses actual authentication result instead of fake auth object
 * 
 * @param handlerResponse - Response from handler
 * @param request - Original request
 * @param env - Worker environment
 * @returns Encrypted response
 */
async function wrapResponseWithEncryption(
  handlerResponse: Response,
  request: Request,
  env: Env
): Promise<Response> {
  // CRITICAL SECURITY: JWT encryption is MANDATORY for all endpoints
  // Authenticate request to get real auth object
  const auth: AuthResult = await authenticateRequest(request, env);
  
  if (!auth.authenticated) {
    // Return 401 error with problem+json format
    const errorResponse = {
      type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
      title: 'Unauthorized',
      status: 401,
      detail: 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.',
      instance: request.url,
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

  // Use REAL auth result with proper customerId and JWT token
  // This aligns with the current API framework patterns
  const authForEncryption = {
    userId: auth.userId || 'anonymous',
    customerId: auth.customerId || null,
    jwtToken: auth.jwtToken,
  };

  // Use API framework's wrapWithEncryption - but disable for HttpOnly cookie auth (browser can't decrypt)
  // (JavaScript can't access HttpOnly cookies to decrypt, and HTTPS already protects data in transit)
  const result = await wrapWithEncryption(
    handlerResponse, 
    null, // Pass null to disable encryption for HttpOnly cookies
    request, 
    env,
    {
      requireJWT: false
    }
  );
  
  return result.response;
}

/**
 * Route requests to appropriate handlers
 * 
 * Handles all HTTP methods and routes for the Chat Signaling worker
 * Applies JWT encryption to all responses
 * 
 * @param request - Incoming HTTP request
 * @param env - Worker environment
 * @returns HTTP response (encrypted)
 */
export async function route(
  request: Request, 
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Health check
    if (path === '/health' || path === '/') {
      return handleHealth(request, env);
    }

    // Signaling endpoints (room management)
    if (path === '/signaling/create-room' && request.method === 'POST') {
      const response = await handleCreateRoom(request, env);
      return await wrapResponseWithEncryption(response, request, env);
    }

    if (path === '/signaling/join-room' && request.method === 'POST') {
      const response = await handleJoinRoom(request, env);
      return await wrapResponseWithEncryption(response, request, env);
    }

    // Signaling endpoints (WebRTC offer/answer exchange)
    if (path === '/signaling/offer' && request.method === 'POST') {
      const response = await handleSendOffer(request, env);
      return await wrapResponseWithEncryption(response, request, env);
    }

    if (path.startsWith('/signaling/offer/') && request.method === 'GET') {
      const response = await handleGetOffer(request, env);
      return await wrapResponseWithEncryption(response, request, env);
    }

    if (path === '/signaling/answer' && request.method === 'POST') {
      const response = await handleSendAnswer(request, env);
      return await wrapResponseWithEncryption(response, request, env);
    }

    if (path.startsWith('/signaling/answer/') && request.method === 'GET') {
      const response = await handleGetAnswer(request, env);
      return await wrapResponseWithEncryption(response, request, env);
    }

    // Signaling endpoints (room lifecycle)
    if (path === '/signaling/heartbeat' && request.method === 'POST') {
      const response = await handleHeartbeat(request, env);
      return await wrapResponseWithEncryption(response, request, env);
    }

    if (path === '/signaling/rooms' && request.method === 'GET') {
      const response = await handleGetRooms(request, env);
      return await wrapResponseWithEncryption(response, request, env);
    }

    if (path === '/signaling/leave' && request.method === 'POST') {
      const response = await handleLeaveRoom(request, env);
      return await wrapResponseWithEncryption(response, request, env);
    }

    // Party room endpoints (opt-in room splitting)
    if (path === '/signaling/create-party-room' && request.method === 'POST') {
      const response = await handleCreatePartyRoom(request, env);
      return await wrapResponseWithEncryption(response, request, env);
    }

    if (path.startsWith('/signaling/party-rooms/') && request.method === 'GET') {
      const response = await handleGetPartyRooms(request, env);
      return await wrapResponseWithEncryption(response, request, env);
    }

    if (path.startsWith('/signaling/party-room/') && path.endsWith('/invite') && request.method === 'POST') {
      const response = await handleInviteToPartyRoom(request, env);
      return await wrapResponseWithEncryption(response, request, env);
    }

    // Not found
    const errorResponse: ErrorResponse = { 
      error: 'Not found',
      message: `Endpoint ${path} not found` 
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 404,
      headers: { 
        ...getCorsHeaders(env, request), 
        'Content-Type': 'application/json' 
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chat Signaling Router] Error:', errorMessage, error);
    
    const errorResponse: ErrorResponse = {
      error: 'Internal server error',
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
