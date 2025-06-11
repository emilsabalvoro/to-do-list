# to-do-list
Engineering exam for a company. Uses Node.JS with Express and SQLite.

Why This is the Simplest:

Single File: Everything in one server.js file
No Database Setup: Uses SQLite in-memory
Minimal Dependencies: Just Express and SQLite3
No Configuration: Works out of the box
No Build Process: Pure JavaScript, no compilation needed

API Endpoints:

GET /tasks - List tasks with pagination
POST /tasks - Create new task
GET /tasks/:id - Get specific task
PUT /tasks/:id - Update task
DELETE /tasks/:id - Delete task
POST /tasks/reorder - Handle drag & drop reordering
GET /health - Health check
POST /seed - Generate test data

Setup / Testing:
1. Run composer install
2. Run node server.js

A. Health Check
Request:

Method: GET
URL: http://localhost:3000/health

Expected Response:
json{
    "success": true,
    "message": "TODO API is running",
    "timestamp": "2025-06-10T10:30:00.000Z"
}

B. Seed Test Data (Create Sample Tasks)
Request:

Method: POST
URL: http://localhost:3000/seed?count=10

Expected Response:
json{
    "success": true,
    "message": "10 tasks created successfully"
}

C. List All Tasks
Request:

Method: GET
URL: http://localhost:3000/tasks

Optional Query Parameters:

page=1 - Page number
limit=10 - Items per page
completed=true - Filter by completion status

Example URLs:

http://localhost:3000/tasks?page=1&limit=5
http://localhost:3000/tasks?completed=false

Expected Response:
json{
    "success": true,
    "data": [
        {
            "id": 1,
            "title": "Task 1",
            "description": "Description for task 1",
            "completed": 0,
            "position": 1000,
            "created_at": "2025-06-10 10:30:00",
            "updated_at": "2025-06-10 10:30:00"
        }
    ],
    "pagination": {
        "current_page": 1,
        "per_page": 100,
        "total": 10,
        "total_pages": 1
    }
}

D. Create a New Task
Request:

Method: POST
URL: http://localhost:3000/tasks
Headers: Content-Type: application/json

Body (JSON):
json{
    "title": "Buy groceries",
    "description": "Milk, bread, eggs",
    "completed": false
}
Expected Response:
json{
    "success": true,
    "message": "Task created successfully",
    "data": {
        "id": 11,
        "title": "Buy groceries",
        "description": "Milk, bread, eggs",
        "completed": 0,
        "position": 11000,
        "created_at": "2025-06-10 10:35:00",
        "updated_at": "2025-06-10 10:35:00"
    }
}

E. Get a Specific Task
Request:

Method: GET
URL: http://localhost:3000/tasks/1

Expected Response:
json{
    "success": true,
    "data": {
        "id": 1,
        "title": "Task 1",
        "description": "Description for task 1",
        "completed": 0,
        "position": 1000,
        "created_at": "2025-06-10 10:30:00",
        "updated_at": "2025-06-10 10:30:00"
    }
}

F. Update a Task
Request:

Method: PUT
URL: http://localhost:3000/tasks/1
Headers: Content-Type: application/json

Body (JSON) - You can update any/all fields:
json{
    "title": "Updated Task Title",
    "description": "Updated description",
    "completed": true
}
Expected Response:
json{
    "success": true,
    "message": "Task updated successfully",
    "data": {
        "id": 1,
        "title": "Updated Task Title",
        "description": "Updated description",
        "completed": 1,
        "position": 1000,
        "created_at": "2025-06-10 10:30:00",
        "updated_at": "2025-06-10 10:40:00"
    }
}

G. Reorder a Task (Drag & Drop)
Request:

Method: POST
URL: http://localhost:3000/tasks/reorder
Headers: Content-Type: application/json

Body (JSON):
json{
    "task_id": 1,
    "new_position": 3
}
Expected Response:
json{
    "success": true,
    "message": "Task reordered successfully",
    "data": {
        "id": 1,
        "title": "Updated Task Title",
        "description": "Updated description",
        "completed": 1,
        "position": 3500.5,
        "created_at": "2025-06-10 10:30:00",
        "updated_at": "2025-06-10 10:45:00"
    }
}

H. Delete a Task
Request:

Method: DELETE
URL: http://localhost:3000/tasks/1

Expected Response:
json{
    "success": true,
    "message": "Task deleted successfully"
}

Performance Optimizations for 1M+ Tasks

1. Fractional Positioning Strategy:

Uses decimal positions instead of sequential integers
Allows insertion between any two tasks without affecting others
Handles 50+ moves efficiently by calculating midpoint positions

2. Database Optimizations:

Composite index on (position, id) for fast ordering
High-precision decimal field for positions
Pagination to handle large datasets
Bulk operations for better performance

3. Smart Rebalancing:

Automatically rebalances positions when they get too close
Prevents precision issues after many operations
Only triggers when necessary to maintain performance