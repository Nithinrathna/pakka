from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
import jwt
import bcrypt
import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# ✅ Updated CORS configuration
CORS(app)

# MongoDB connection
client = MongoClient(os.getenv('MONGO_URI', 'mongodb+srv://nameisnithin4:McACLuM8idG5XKpt@cluster0.vpdhiop.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'))
db = client['auth_db']
users_collection = db['users']

# JWT Secret
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')
JWT_EXPIRATION_HOURS = 24

@app.route('/signup', methods=['POST'])
def signup():
    try:
        data = request.json
        
        if not all(key in data for key in ['fullName', 'email', 'password']):
            return jsonify({'error': 'Missing required fields'}), 400
        
        if users_collection.find_one({'email': data['email']}):
            return jsonify({'error': 'Email already registered'}), 409
        
        hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
        
        new_user = {
            'fullName': data['fullName'],
            'email': data['email'],
            'password': hashed_password,
            'createdAt': datetime.datetime.utcnow()
        }
        
        result = users_collection.insert_one(new_user)
        
        user_id = str(result.inserted_id)
        
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'userId': user_id
        }), 201
        
    except Exception as e:
        print(f"Error in signup: {str(e)}")
        return jsonify({'error': 'Server error during registration'}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        
        if not all(key in data for key in ['email', 'password']):
            return jsonify({'error': 'Missing email or password'}), 400
        
        user = users_collection.find_one({'email': data['email']})
        
        if not user or not bcrypt.checkpw(data['password'].encode('utf-8'), user['password']):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        expiration = datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRATION_HOURS)
        token = jwt.encode({
            'userId': str(user['_id']),
            'email': user['email'],
            'exp': expiration
        }, JWT_SECRET, algorithm='HS256')
        
        return jsonify({
            'success': True,
            'token': token,
            'userId': str(user['_id']),
            'fullName': user['fullName']
        }), 200
        
    except Exception as e:
        print(f"Error in login: {str(e)}")
        return jsonify({'error': 'Server error during login'}), 500

# Middleware to verify JWT token
def token_required(f):
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
            
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            current_user = users_collection.find_one({'_id': ObjectId(data['userId'])})
            
            if not current_user:
                return jsonify({'error': 'Invalid token'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except Exception:
            return jsonify({'error': 'Invalid token'}), 401
            
        return f(current_user, *args, **kwargs)
    
    decorated.__name__ = f.__name__
    return decorated

@app.route('/user/profile', methods=['GET'])
@token_required
def get_user_profile(current_user):
    user_data = {
        'userId': str(current_user['_id']),
        'fullName': current_user['fullName'],
        'email': current_user['email'],
        'createdAt': current_user['createdAt']
    }
    return jsonify(user_data), 200

@app.route('/user/profile', methods=['PUT'])
@token_required
def update_user_profile(current_user):
    try:
        data = request.json
        updates = {}
        
        if 'fullName' in data:
            updates['fullName'] = data['fullName']
            
        if not updates:
            return jsonify({'message': 'No updates provided'}), 400
            
        users_collection.update_one(
            {'_id': current_user['_id']},
            {'$set': updates}
        )
        
        return jsonify({'success': True, 'message': 'Profile updated successfully'}), 200
        
    except Exception as e:
        print(f"Error updating profile: {str(e)}")
        return jsonify({'error': 'Server error while updating profile'}), 500

@app.route('/user/change-password', methods=['POST'])
@token_required
def change_password(current_user):
    try:
        data = request.json
        
        if not all(key in data for key in ['currentPassword', 'newPassword']):
            return jsonify({'error': 'Missing required fields'}), 400
            
        if not bcrypt.checkpw(data['currentPassword'].encode('utf-8'), current_user['password']):
            return jsonify({'error': 'Current password is incorrect'}), 401
            
        new_hashed_password = bcrypt.hashpw(data['newPassword'].encode('utf-8'), bcrypt.gensalt())
        
        users_collection.update_one(
            {'_id': current_user['_id']},
            {'$set': {'password': new_hashed_password}}
        )
        
        return jsonify({'success': True, 'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        print(f"Error changing password: {str(e)}")
        return jsonify({'error': 'Server error while changing password'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5004, debug=True)