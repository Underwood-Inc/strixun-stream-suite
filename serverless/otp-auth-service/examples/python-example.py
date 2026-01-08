"""
Python Example - OTP Authentication Integration

Example Flask server using the OTP Auth Service
"""

from flask import Flask, request, jsonify, make_response
import requests
import os

app = Flask(__name__)

OTP_API_KEY = os.getenv('OTP_API_KEY')
OTP_BASE_URL = os.getenv('OTP_BASE_URL', 'https://otp-auth-service.workers.dev')

def request_otp(email: str):
    """Request OTP code"""
    response = requests.post(
        f'{OTP_BASE_URL}/auth/request-otp',
        headers={
            'Content-Type': 'application/json',
            'X-OTP-API-Key': OTP_API_KEY  # API keys go in X-OTP-API-Key header, NOT Authorization
        },
        json={'email': email}
    )
    response.raise_for_status()
    return response.json()

def verify_otp(email: str, otp: str):
    """Verify OTP and get token"""
    response = requests.post(
        f'{OTP_BASE_URL}/auth/verify-otp',
        headers={
            'Content-Type': 'application/json',
            'X-OTP-API-Key': OTP_API_KEY  # API keys go in X-OTP-API-Key header, NOT Authorization
        },
        json={'email': email, 'otp': otp}
    )
    response.raise_for_status()
    return response.json()

def get_user_info(token: str):
    """Get user information - requires JWT token from verify_otp"""
    response = requests.get(
        f'{OTP_BASE_URL}/auth/me',
        headers={'Authorization': f'Bearer {token}'}  # JWT token goes in Authorization header
    )
    response.raise_for_status()
    return response.json()

@app.route('/api/auth/request-otp', methods=['POST'])
def handle_request_otp():
    try:
        data = request.json
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email required'}), 400
        
        result = request_otp(email)
        return jsonify(result)
    except requests.exceptions.HTTPError as e:
        return jsonify({'error': str(e)}), e.response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/verify-otp', methods=['POST'])
def handle_verify_otp():
    try:
        data = request.json
        email = data.get('email')
        otp = data.get('otp')
        
        if not email or not otp:
            return jsonify({'error': 'Email and OTP required'}), 400
        
        result = verify_otp(email, otp)
        
        # Set token in HTTP-only cookie
        response = make_response(jsonify({
            'success': True,
            'userId': result['userId'],
            'email': result['email']
        }))
        response.set_cookie(
            'auth_token',
            result['token'],
            httponly=True,
            secure=True,
            max_age=7 * 60 * 60  # 7 hours
        )
        return response
    except requests.exceptions.HTTPError as e:
        return jsonify({'error': str(e)}), e.response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/me', methods=['GET'])
def handle_get_me():
    try:
        token = request.cookies.get('auth_token') or \
                request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        user = get_user_info(token)
        return jsonify(user)
    except requests.exceptions.HTTPError as e:
        return jsonify({'error': str(e)}), e.response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/logout', methods=['POST'])
def handle_logout():
    try:
        token = request.cookies.get('auth_token') or \
                request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if token:
            requests.post(
                f'{OTP_BASE_URL}/auth/logout',
                headers={'Authorization': f'Bearer {token}'}
            )
        
        response = make_response(jsonify({'success': True, 'message': 'Logged out'}))
        response.set_cookie('auth_token', '', expires=0)
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=int(os.getenv('PORT', 3000)))

