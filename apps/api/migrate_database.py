#!/usr/bin/env python3
"""
Database migration script for the Neural Network Builder
"""
import sqlite3
from datetime import datetime

def migrate_database():
    conn = sqlite3.connect('nn_builder.db')
    cursor = conn.cursor()
    
    try:
        # Create basic tables if they don't exist
        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                is_verified BOOLEAN DEFAULT FALSE,
                verification_token TEXT,
                password_reset_token TEXT,
                password_reset_expires TIMESTAMP,
                last_login TIMESTAMP,
                last_login_ip TEXT,
                failed_login_attempts INTEGER DEFAULT 0,
                locked_until TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Created/verified users table")
        
        # Saved models table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS saved_models (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                model_data TEXT NOT NULL,
                model_size_bytes INTEGER,
                model_version TEXT DEFAULT '1.0',
                is_public BOOLEAN DEFAULT FALSE,
                is_template BOOLEAN DEFAULT FALSE,
                access_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        print("Created/verified saved_models table")
        
        # Create indexes for better performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_email 
            ON users (email)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_username 
            ON users (username)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_saved_models_user_id 
            ON saved_models (user_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_saved_models_name 
            ON saved_models (name)
        """)
        
        # Commit changes
        conn.commit()
        print("Database migration completed successfully!")
        
        # Show some stats
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        print(f"Total users: {user_count}")
        
        cursor.execute("SELECT COUNT(*) FROM saved_models")
        model_count = cursor.fetchone()[0]
        print(f"Total saved models: {model_count}")
        
    except Exception as e:
        print(f"Migration error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database() 