from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres.hofziopcoimjevmelbuh:111333555777999BPM@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"
engine = create_engine(DATABASE_URL)

def update_schema():
    with engine.connect() as conn:
        print("Checking and adding missing columns...")
        
        # เพิ่มคอลัมน์ในตาราง study_group
        try:
            conn.execute(text("ALTER TABLE study_group ADD COLUMN is_registered BOOLEAN DEFAULT FALSE"))
            print("- Added is_registered to study_group")
        except Exception as e:
            print("- is_registered already exists or error:", str(e).split('\n')[0])

        try:
            conn.execute(text("ALTER TABLE study_group ADD COLUMN last_action VARCHAR(100)"))
            print("- Added last_action to study_group")
        except Exception as e:
            print("- last_action already exists or error:", str(e).split('\n')[0])

        # เพิ่มคอลัมน์ในตาราง group_member
        try:
            conn.execute(text("ALTER TABLE group_member ADD COLUMN last_notified_action VARCHAR(100)"))
            print("- Added last_notified_action to group_member")
        except Exception as e:
            print("- last_notified_action already exists or error:", str(e).split('\n')[0])
            
        conn.commit()
        print("Database schema updated successfully!")

if __name__ == "__main__":
    update_schema()
