const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Professional architectural floorplan generator
function generateArchitecturalData(plotWidth, plotDepth, bedrooms, vaastu) {
    // Scale factor for drawing (1ft = 2px for better detail)
    const scale = 2;
    
    // Outer boundary walls
    const walls = {
        outer: {
            north: { x: 0, y: 0, width: plotWidth * scale, height: 4, type: 'exterior' },
            south: { x: 0, y: (plotDepth * scale) - 4, width: plotWidth * scale, height: 4, type: 'exterior' },
            east: { x: (plotWidth * scale) - 4, y: 0, width: 4, height: plotDepth * scale, type: 'exterior' },
            west: { x: 0, y: 0, width: 4, height: plotDepth * scale, type: 'exterior' }
        },
        interior: []
    };
    
    // Room layouts based on bedrooms
    const rooms = [];
    let currentX = 8 * scale;
    let currentY = 8 * scale;
    
    // 1. Foyer/Lobby
    rooms.push({
        id: 'foyer',
        name: 'LOBBY / FOYER',
        x: currentX,
        y: currentY,
        width: 10 * scale,
        depth: 12 * scale,
        area: 120,
        walls: ['north', 'south', 'east', 'west'],
        doors: [{ position: 'south', x: currentX + 4 * scale, y: currentY + 12 * scale, width: 3 * scale }],
        windows: [{ position: 'north', x: currentX + 3 * scale, y: currentY, width: 4 * scale }],
        color: '#FFF8DC',
        type: 'common'
    });
    
    currentX += 12 * scale;
    
    // 2. Living & Dining combined
    rooms.push({
        id: 'living',
        name: 'LIVING & DINING',
        x: currentX,
        y: currentY,
        width: 18 * scale,
        depth: 14 * scale,
        area: 252,
        walls: ['north', 'south', 'east', 'west'],
        doors: [{ position: 'south', x: currentX + 8 * scale, y: currentY + 14 * scale, width: 4 * scale }],
        windows: [{ position: 'north', x: currentX + 6 * scale, y: currentY, width: 6 * scale }],
        color: '#FFF8DC',
        type: 'common'
    });
    
    currentX += 20 * scale;
    
    // 3. Staircase
    const stairX = currentX;
    rooms.push({
        id: 'staircase',
        name: 'STAIRCASE',
        x: stairX,
        y: currentY,
        width: 6 * scale,
        depth: 14 * scale,
        area: 84,
        walls: ['north', 'south', 'east', 'west'],
        doors: [{ position: 'west', x: stairX, y: currentY + 6 * scale, width: 3 * scale }],
        direction: 'UP',
        color: '#E8E8E8',
        type: 'circulation'
    });
    
    // Reset Y for next row
    currentY += 16 * scale;
    currentX = 8 * scale;
    
    // 4. Kitchen
    rooms.push({
        id: 'kitchen',
        name: 'KITCHEN',
        x: currentX,
        y: currentY,
        width: 12 * scale,
        depth: 10 * scale,
        area: 120,
        walls: ['north', 'south', 'east', 'west'],
        doors: [{ position: 'north', x: currentX + 5 * scale, y: currentY, width: 3 * scale }],
        windows: [{ position: 'south', x: currentX + 4 * scale, y: currentY + 10 * scale, width: 4 * scale }],
        color: '#FFF0E0',
        type: 'service'
    });
    
    currentX += 14 * scale;
    
    // 5. Utility
    rooms.push({
        id: 'utility',
        name: 'UTILITY',
        x: currentX,
        y: currentY,
        width: 8 * scale,
        depth: 8 * scale,
        area: 64,
        walls: ['north', 'south', 'east', 'west'],
        doors: [{ position: 'north', x: currentX + 3 * scale, y: currentY, width: 2.5 * scale }],
        color: '#F5E6D3',
        type: 'service'
    });
    
    currentX += 10 * scale;
    
    // 6. Common Toilet
    rooms.push({
        id: 'toilet_common',
        name: 'TOILET Common',
        x: currentX,
        y: currentY,
        width: 6 * scale,
        depth: 8 * scale,
        area: 48,
        walls: ['north', 'south', 'east', 'west'],
        doors: [{ position: 'north', x: currentX + 2 * scale, y: currentY, width: 2.5 * scale }],
        color: '#E0F0F0',
        type: 'bathroom'
    });
    
    // Bedrooms row
    currentY += 12 * scale;
    currentX = 8 * scale;
    
    // Generate bedrooms based on count
    const bedroomConfigs = [
        { name: 'MASTER BEDROOM', width: 14, depth: 16, area: 224, attachedToilet: true, balcony: true },
        { name: 'BEDROOM 2', width: 12, depth: 14, area: 168, attachedToilet: false, balcony: false },
        { name: 'BEDROOM 3', width: 12, depth: 14, area: 168, attachedToilet: false, balcony: false },
        { name: 'BEDROOM 4', width: 11, depth: 12, area: 132, attachedToilet: false, balcony: false }
    ];
    
    for (let i = 0; i < Math.min(bedrooms, 4); i++) {
        const config = bedroomConfigs[i];
        const bedroom = {
            id: `bedroom_${i + 1}`,
            name: config.name,
            x: currentX,
            y: currentY,
            width: config.width * scale,
            depth: config.depth * scale,
            area: config.area,
            walls: ['north', 'south', 'east', 'west'],
            doors: [{ position: 'south', x: currentX + (config.width/2) * scale, y: currentY + config.depth * scale, width: 3.5 * scale }],
            windows: [
                { position: 'north', x: currentX + (config.width/3) * scale, y: currentY, width: 4 * scale },
                { position: 'east', x: currentX + config.width * scale, y: currentY + 5 * scale, width: 3 * scale }
            ],
            color: '#E8F4FD',
            type: 'bedroom'
        };
        
        if (config.attachedToilet) {
            bedroom.attachedToilet = {
                name: 'TOILET Attached',
                x: currentX + config.width * scale - 5 * scale,
                y: currentY,
                width: 5 * scale,
                depth: 5 * scale,
                area: 25
            };
        }
        
        if (config.balcony) {
            bedroom.balcony = {
                name: 'BALCONY',
                x: currentX,
                y: currentY - 3 * scale,
                width: 8 * scale,
                depth: 3 * scale,
                area: 24
            };
        }
        
        rooms.push(bedroom);
        currentX += (config.width + 2) * scale;
    }
    
    // Calculate built-up area
    const builtUpArea = rooms.reduce((sum, room) => sum + room.area, 0);
    
    return {
        plot: { width: plotWidth, depth: plotDepth, area: plotWidth * plotDepth },
        constraints: { bedrooms, vaastu },
        walls: walls,
        rooms: rooms,
        statistics: {
            builtUpArea: builtUpArea,
            carpetArea: builtUpArea * 0.85,
            circulationArea: builtUpArea * 0.15
        },
        scale: scale,
        unit: 'feet'
    };
}

// API Endpoint
app.post('/api/floorplan/generate', (req, res) => {
    console.log('🏗 Generating PROFESSIONAL ARCHITECTURAL DATA');
    console.log('📥 Input:', req.body);
    
    const { plotWidth, plotDepth, bedrooms, vaastu } = req.body;
    
    const floorplanData = generateArchitecturalData(plotWidth, plotDepth, bedrooms, vaastu);
    
    res.json({
        success: true,
        message: "Professional Architectural Floorplan Generated",
        data: floorplanData
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Architectural Floorplan API Running' });
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log('=' .repeat(60));
    console.log('🏗 PROFESSIONAL ARCHITECTURAL FLOORPLAN API');
    console.log('✅ Server running on port 5000');
    console.log('✅ Generating proper architectural data with walls, doors, windows');
    console.log('=' .repeat(60));
});
