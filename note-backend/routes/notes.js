const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const db = admin.firestore();

// Middleware to check authentication
router.use(async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = { uid: decodedToken.uid };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
});

// Create a note
// Create a note
router.post('/notes', async (req, res) => {
    try {
        const { title, content, category, tags } = req.body; // Receive tags from body
        const userId = req.user.uid;

        const noteRef = db.collection('notes').doc();
        await noteRef.set({
            title,
            content,
            category,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            creator: userId,
            tags: tags || [] // Store tags as array
        });
        res.status(201).json({ id: noteRef.id, title, content, category, tags });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create note' });
    }
});


// Fetch notes
router.get('/notes', async (req, res) => {
    try {
        const { sortBy = 'timestamp', order = 'desc' } = req.query;
        const userId = req.user.uid;

        // Validate sortBy parameter
        const validSortFields = ['timestamp'];
        if (!validSortFields.includes(sortBy)) {
            return res.status(400).json({ error: 'Invalid sort field' });
        }

        // Query Firestore with filtering by `uid`
        const notesRef = db.collection('notes');
        const snapshot = await notesRef.where('creator', '==', userId)
            .orderBy(sortBy, order === 'desc' ? 'desc' : 'asc')
            .get();

        const notes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        res.status(200).json(notes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// Update a note
router.put('/notes/:id', async (req, res) => {
    try {
        const noteId = req.params.id;
        const { title, content, category, tags } = req.body; // Receive tags from body

        await db.collection('notes').doc(noteId).update({
            title,
            content,
            category,
            tags // Update tags
        });

        // Save edit history
        await db.collection('notes').doc(noteId).collection('history').add({
            editor: req.user.uid,
            title,
            content,
            category,
            tags,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({ message: 'Note updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update note' });
    }
});

// Delete a note
router.delete('/notes/:id', async (req, res) => {
    try {
        const noteId = req.params.id;

        // Delete the note
        await db.collection('notes').doc(noteId).delete();
        
        // Also delete the note's history
        const historySnapshot = await db.collection('notes').doc(noteId).collection('history').get();
        historySnapshot.forEach(doc => doc.ref.delete());

        res.status(200).json({ message: 'Note deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete note' });
    }
});

module.exports = router;
