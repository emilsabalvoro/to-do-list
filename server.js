// server.js - Complete TODO API in a single file

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Database setup
const db = new sqlite3.Database(':memory:'); // Use file: './todos.db' for persistence

// Initialize database
db.serialize(() => {
    db.run(`
        CREATE TABLE tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            completed BOOLEAN DEFAULT 0,
            position REAL DEFAULT 1000,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    db.run(`CREATE INDEX idx_position_id ON tasks(position, id)`);
    db.run(`CREATE INDEX idx_completed ON tasks(completed)`);
});

// Helper functions
const promiseQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const promiseRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

const getNextPosition = async () => {
    const result = await promiseQuery('SELECT MAX(position) as max_pos FROM tasks');
    return result[0].max_pos ? result[0].max_pos + 1000 : 1000;
};

const calculateNewPosition = (allTasks, currentIndex, newPosition) => {
    const task = allTasks[currentIndex];
    const tasksWithoutCurrent = allTasks.filter(t => t.id !== task.id);
    
    if (tasksWithoutCurrent.length === 0) return 1000;
    
    if (newPosition === 0) {
        return Math.max(tasksWithoutCurrent[0].position - 500, 1);
    } else if (newPosition >= tasksWithoutCurrent.length) {
        return tasksWithoutCurrent[tasksWithoutCurrent.length - 1].position + 1000;
    } else {
        const prevTask = tasksWithoutCurrent[newPosition - 1];
        const nextTask = tasksWithoutCurrent[newPosition];
        return prevTask.position + (nextTask.position - prevTask.position) / 2;
    }
};

const shouldRebalance = (allTasks) => {
    for (let i = 1; i < allTasks.length; i++) {
        if (allTasks[i].position - allTasks[i - 1].position < 0.001) {
            return true;
        }
    }
    return false;
};

const rebalancePositions = async () => {
    const tasks = await promiseQuery('SELECT id FROM tasks ORDER BY position, id');
    let position = 1000;
    
    for (const task of tasks) {
        await promiseRun('UPDATE tasks SET position = ? WHERE id = ?', [position, task.id]);
        position += 1000;
    }
};

// Routes

// GET /tasks - List all tasks
app.get('/tasks', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
        const offset = (page - 1) * limit;
        const completed = req.query.completed;
        
        let whereClause = '';
        let params = [];
        
        if (completed !== undefined) {
            whereClause = 'WHERE completed = ?';
            params.push(completed === 'true' ? 1 : 0);
        }
        
        const tasks = await promiseQuery(
            `SELECT * FROM tasks ${whereClause} ORDER BY position, id LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        
        const totalResult = await promiseQuery(
            `SELECT COUNT(*) as total FROM tasks ${whereClause}`,
            params
        );
        
        const total = totalResult[0].total;
        
        res.json({
            success: true,
            data: tasks,
            pagination: {
                current_page: page,
                per_page: limit,
                total: total,
                total_pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /tasks - Create a new task
app.post('/tasks', async (req, res) => {
    try {
        const { title, description, completed = false } = req.body;
        
        if (!title) {
            return res.status(400).json({ 
                success: false, 
                error: 'Title is required' 
            });
        }
        
        const position = await getNextPosition();
        
        const result = await promiseRun(
            'INSERT INTO tasks (title, description, completed, position) VALUES (?, ?, ?, ?)',
            [title, description, completed ? 1 : 0, position]
        );
        
        const task = await promiseQuery('SELECT * FROM tasks WHERE id = ?', [result.id]);
        
        res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: task[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /tasks/:id - Get a specific task
app.get('/tasks/:id', async (req, res) => {
    try {
        const task = await promiseQuery('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
        
        if (task.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Task not found' 
            });
        }
        
        res.json({
            success: true,
            data: task[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /tasks/:id - Update a task
app.put('/tasks/:id', async (req, res) => {
    try {
        const { title, description, completed } = req.body;
        const updates = [];
        const params = [];
        
        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (completed !== undefined) {
            updates.push('completed = ?');
            params.push(completed ? 1 : 0);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No fields to update' 
            });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);
        
        const result = await promiseRun(
            `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Task not found' 
            });
        }
        
        const task = await promiseQuery('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
        
        res.json({
            success: true,
            message: 'Task updated successfully',
            data: task[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /tasks/:id - Delete a task
app.delete('/tasks/:id', async (req, res) => {
    try {
        const result = await promiseRun('DELETE FROM tasks WHERE id = ?', [req.params.id]);
        
        if (result.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Task not found' 
            });
        }
        
        res.json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /tasks/reorder - Reorder a single task (drag & drop)
app.post('/tasks/reorder', async (req, res) => {
    try {
        const { task_id, new_position } = req.body;
        
        if (!task_id || new_position === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'task_id and new_position are required' 
            });
        }
        
        const allTasks = await promiseQuery('SELECT * FROM tasks ORDER BY position, id');
        const currentIndex = allTasks.findIndex(t => t.id == task_id);
        
        if (currentIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Task not found' 
            });
        }
        
        const newPos = Math.max(0, Math.min(new_position, allTasks.length - 1));
        
        if (currentIndex === newPos) {
            return res.json({
                success: true,
                message: 'Task position unchanged',
                data: allTasks[currentIndex]
            });
        }
        
        const newPositionValue = calculateNewPosition(allTasks, currentIndex, newPos);
        
        await promiseRun(
            'UPDATE tasks SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newPositionValue, task_id]
        );
        
        // Check if rebalancing is needed
        if (shouldRebalance(allTasks)) {
            await rebalancePositions();
        }
        
        const updatedTask = await promiseQuery('SELECT * FROM tasks WHERE id = ?', [task_id]);
        
        res.json({
            success: true,
            message: 'Task reordered successfully',
            data: updatedTask[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'TODO API is running',
        timestamp: new Date().toISOString()
    });
});

// Seed some test data
app.post('/seed', async (req, res) => {
    try {
        const count = parseInt(req.query.count) || 1000;
        let position = 1000;
        
        for (let i = 1; i <= count; i++) {
            await promiseRun(
                'INSERT INTO tasks (title, description, completed, position) VALUES (?, ?, ?, ?)',
                [`Task ${i}`, `Description for task ${i}`, Math.random() > 0.5 ? 1 : 0, position]
            );
            position += 1000;
        }
        
        res.json({
            success: true,
            message: `${count} tasks created successfully`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`TODO API running on http://localhost:${PORT}`);
    console.log('\nAvailable endpoints:');
    console.log('GET    /tasks              - List all tasks');
    console.log('POST   /tasks              - Create a new task');
    console.log('GET    /tasks/:id          - Get a specific task');
    console.log('PUT    /tasks/:id          - Update a task');
    console.log('DELETE /tasks/:id          - Delete a task');
    console.log('POST   /tasks/reorder      - Reorder a single task');
    console.log('GET    /health             - Health check');
    console.log('POST   /seed?count=1000    - Seed test data');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    db.close();
    process.exit(0);
});