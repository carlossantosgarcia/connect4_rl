const ROWS = 6;
const COLUMNS = 7;
const CONNECT_N = 4;
const HUMAN_PLAYER = 1;
const AI_PLAYER = -1;
const CELL_SIZE = 80;
const PIECE_RADIUS_RATIO = 0.8;

// DOM Elements
const boardContainer = document.getElementById('board-container');
const modelSelect = document.getElementById('model-select');
const depthSlider = document.getElementById('depth-slider');
const depthLabelDisplay = document.getElementById('depth-label-display');
const depthControlContainer = document.getElementById('depth-control-container');
const statusMessage = document.getElementById('status-message');
const resetGameButton = document.getElementById('reset-game');
const modelGamesPlayedSpan = document.getElementById('model-games-played');
const playerFirstToggle = document.getElementById('player-first-toggle');

// Game State
let board = [];
let currentPlayer;
let gameActive = false;
let humanStarts = false;

// AI State
let aiModelSession = null;
let selectedAgentType = 'minimax';
let currentModelIdentifier = '';

const InferenceSession = ort.InferenceSession;

function updateStatusMessage(message, isPlayerTurn = null) {
    statusMessage.textContent = message;
    statusMessage.className = '';
    if (isPlayerTurn === true) statusMessage.classList.add('your-turn');
    else if (isPlayerTurn === false) statusMessage.classList.add('ai-turn');
}

document.addEventListener('DOMContentLoaded', () => {
    initializeBoardDOM();
    loadModelsDropdown();
    setupEventListeners();
});

function setupEventListeners() {
    modelSelect.addEventListener('change', onModelSelected);
    depthSlider.addEventListener('input', onDepthChanged);
    resetGameButton.addEventListener('click', resetGame);
    playerFirstToggle.addEventListener('click', togglePlayerStart);
}

function togglePlayerStart() {
    humanStarts = !humanStarts;
    playerFirstToggle.textContent = humanStarts ? "Player Starts" : "AI Starts";
    playerFirstToggle.classList.toggle('active', humanStarts);
    resetGame();
}

async function loadModelsDropdown() {
    modelSelect.innerHTML = '<option value="minimax">Minimax AI</option>';
    try {
        const response = await fetch('models/models.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const models = await response.json();
        models.forEach(model => {
            if (model && model.file && model.name) {
                const option = document.createElement('option');
                option.value = model.file;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Failed to load models.json:", error);
        modelSelect.innerHTML += '<option disabled>Error loading models</option>';
    }
    onModelSelected();
}

async function onModelSelected() {
    const selectedValue = modelSelect.value;
    gameActive = false;

    if (selectedValue === 'minimax') {
        selectedAgentType = 'minimax';
        aiModelSession = null;
        depthControlContainer.style.display = 'flex';
        currentModelIdentifier = `minimax-d${depthSlider.value}`;
        updateStatusMessage(`Playing against Minimax. ${humanStarts ? "Your turn." : "AI is thinking..."}`, humanStarts);
        resetGame();
    } else {
        selectedAgentType = 'onnx';
        currentModelIdentifier = selectedValue;
        depthControlContainer.style.display = 'none';
        updateStatusMessage(`Loading model: ${modelSelect.selectedOptions[0].text}...`);
        try {
            aiModelSession = await InferenceSession.create(`models/${selectedValue}`, { executionProviders: ['wasm'] });
            updateStatusMessage(`Model loaded. ${humanStarts ? "Your turn." : "AI is thinking..."}`, humanStarts);
            resetGame();
        } catch (error) {
            console.error("Failed to load ONNX model:", error);
            updateStatusMessage("Error loading AI model.");
            aiModelSession = null;
            selectedAgentType = null;
            resetGame();
        }
    }
    updateGameStats(currentModelIdentifier);
}

function onDepthChanged() {
    depthLabelDisplay.textContent = `Depth: ${depthSlider.value}`;
    if (selectedAgentType === 'minimax') {
        currentModelIdentifier = `minimax-d${depthSlider.value}`;
        updateGameStats(currentModelIdentifier);
        resetGame();
    }
}

function initializeBoardDOM() {
    boardContainer.innerHTML = '';
    boardContainer.style.gridTemplateColumns = `repeat(${COLUMNS}, 1fr)`;
    boardContainer.style.width = `${COLUMNS * CELL_SIZE}px`;
    boardContainer.style.height = `${ROWS * CELL_SIZE}px`;

    for (let c = 0; c < COLUMNS; c++) {
        const columnDiv = document.createElement('div');
        columnDiv.classList.add('column-hover-area');
        columnDiv.dataset.column = c;
        columnDiv.addEventListener('click', () => handleColumnClick(c));
        for (let r = 0; r < ROWS; r++) {
            const cellDiv = document.createElement('div');
            cellDiv.classList.add('cell');
            cellDiv.id = `cell-${r}-${c}`;
            cellDiv.style.width = `${CELL_SIZE}px`;
            cellDiv.style.height = `${CELL_SIZE}px`;
            const pieceDiv = document.createElement('div');
            pieceDiv.classList.add('piece');
            pieceDiv.style.width = `${CELL_SIZE * PIECE_RADIUS_RATIO}px`;
            pieceDiv.style.height = `${CELL_SIZE * PIECE_RADIUS_RATIO}px`;
            cellDiv.appendChild(pieceDiv);
            columnDiv.appendChild(cellDiv);
        }
        boardContainer.appendChild(columnDiv);
    }
}

function renderBoard() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLUMNS; c++) {
            const pieceDiv = document.getElementById(`cell-${r}-${c}`).querySelector('.piece');
            pieceDiv.classList.remove('player1', 'player2', 'winning-piece'); // Remove winning class too
            if (board[r][c] === HUMAN_PLAYER) pieceDiv.classList.add('player1');
            else if (board[r][c] === AI_PLAYER) pieceDiv.classList.add('player2');
        }
    }
}

function resetGame() {
    board = Array(ROWS).fill(null).map(() => Array(COLUMNS).fill(0));
    currentPlayer = humanStarts ? HUMAN_PLAYER : AI_PLAYER;
    gameActive = !!selectedAgentType;
    
    // Remove any winning highlights from the previous game
    document.querySelectorAll('.winning-piece').forEach(el => el.classList.remove('winning-piece'));

    renderBoard();
    updateGameStats(currentModelIdentifier);
    
    if (!gameActive) {
        updateStatusMessage("Select an AI to start.");
        return;
    }
    
    updateStatusMessage(humanStarts ? "Your turn" : "AI's turn. Thinking...", humanStarts);

    if (currentPlayer === AI_PLAYER && gameActive) {
        setTimeout(aiMove, 500);
    }
}

function handleColumnClick(col) {
    if (!gameActive || currentPlayer !== HUMAN_PLAYER) return;
    if (isValidAction(col)) makeMove(col, HUMAN_PLAYER);
}

function makeMove(col, player) {
    if (!gameActive) return;

    for (let r = 0; r < ROWS; r++) {
        if (board[r][col] === 0) {
            board[r][col] = player;
            renderBoard();

            const winResult = checkWin(board, player);
            if (winResult.isWin) {
                highlightWinningPieces(winResult.winningPieces);
                endGame(player);
                return;
            }
            if (isBoardFull()) {
                endGame(0);
                return;
            }
            switchPlayer();
            return;
        }
    }
}

function switchPlayer() {
    currentPlayer = (currentPlayer === HUMAN_PLAYER) ? AI_PLAYER : HUMAN_PLAYER;
    updateStatusMessage((currentPlayer === HUMAN_PLAYER) ? "Your turn" : "AI's turn. Thinking...", currentPlayer === HUMAN_PLAYER);
    if (currentPlayer === AI_PLAYER && gameActive) setTimeout(aiMove, 100);
}

function isValidAction(col) {
    return board[ROWS - 1][col] === 0;
}

function getLegalActions() {
    const legal = [];
    for (let c = 0; c < COLUMNS; c++) {
        if (isValidAction(c)) legal.push(c);
    }
    return legal;
}

function checkWin(currentBoard, player) {
    // Check horizontal, vertical, and both diagonals
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLUMNS; c++) {
            if (currentBoard[r][c] === player) {
                // Horizontal
                if (c <= COLUMNS - CONNECT_N) {
                    let line = [];
                    for (let i = 0; i < CONNECT_N; i++) line.push({ r, c: c + i });
                    if (line.every(p => currentBoard[p.r][p.c] === player)) return { isWin: true, winningPieces: line };
                }
                // Vertical
                if (r <= ROWS - CONNECT_N) {
                    let line = [];
                    for (let i = 0; i < CONNECT_N; i++) line.push({ r: r + i, c });
                    if (line.every(p => currentBoard[p.r][p.c] === player)) return { isWin: true, winningPieces: line };
                }
                // Positive Diagonal
                if (r <= ROWS - CONNECT_N && c <= COLUMNS - CONNECT_N) {
                    let line = [];
                    for (let i = 0; i < CONNECT_N; i++) line.push({ r: r + i, c: c + i });
                    if (line.every(p => currentBoard[p.r][p.c] === player)) return { isWin: true, winningPieces: line };
                }
                // Negative Diagonal
                if (r >= CONNECT_N - 1 && c <= COLUMNS - CONNECT_N) {
                    let line = [];
                    for (let i = 0; i < CONNECT_N; i++) line.push({ r: r - i, c: c + i });
                    if (line.every(p => currentBoard[p.r][p.c] === player)) return { isWin: true, winningPieces: line };
                }
            }
        }
    }
    return { isWin: false };
}

function highlightWinningPieces(pieces) {
    for (const piece of pieces) {
        const pieceDiv = document.getElementById(`cell-${piece.r}-${piece.c}`).querySelector('.piece');
        pieceDiv.classList.add('winning-piece');
    }
}

function isBoardFull() {
    return board[ROWS - 1].every(cell => cell !== 0);
}

function endGame(winner) {
    gameActive = false;
    if (winner === HUMAN_PLAYER) updateStatusMessage("Congratulations! You win!");
    else if (winner === AI_PLAYER) updateStatusMessage("AI wins! Better luck next time.");
    else updateStatusMessage("It's a draw!");
    if (currentModelIdentifier) incrementGameCount(currentModelIdentifier);
}

async function aiMove() {
    if (!gameActive || currentPlayer !== AI_PLAYER) return;

    let bestAction = -1;
    const legalActions = getLegalActions();
    if (legalActions.length === 0) return;

    try {
        if (selectedAgentType === 'minimax') {
            const depth = parseInt(depthSlider.value, 10);
            bestAction = getMinimaxMove(board, depth);
        } else if (selectedAgentType === 'onnx' && aiModelSession) {
            const boardForAI = board.map(row => row.map(cell => cell * AI_PLAYER)).flat();
            const tensorInput = new ort.Tensor('float32', Float32Array.from(boardForAI), [1, 1, ROWS, COLUMNS]);
            const feeds = { 'input_board': tensorInput };
            const results = await aiModelSession.run(feeds);
            const qValues = results.q_values.data;
            let maxQ = -Infinity;
            for (const action of legalActions) {
                if (qValues[action] > maxQ) {
                    maxQ = qValues[action];
                    bestAction = action;
                }
            }
        }
        if (bestAction !== -1 && legalActions.includes(bestAction)) {
            makeMove(bestAction, AI_PLAYER);
        } else {
            makeMove(legalActions[Math.floor(Math.random() * legalActions.length)], AI_PLAYER);
        }
    } catch (error) {
        console.error("Error during AI move:", error);
        updateStatusMessage("AI error. Choosing random move.");
        makeMove(legalActions[Math.floor(Math.random() * legalActions.length)], AI_PLAYER);
    }
}

function getGameCounts() {
    return JSON.parse(localStorage.getItem('connect4AICounts') || '{}');
}

function updateGameStats(modelId) {
    if (!modelId) {
        modelGamesPlayedSpan.textContent = 'N/A';
        return;
    }
    const counts = getGameCounts();
    modelGamesPlayedSpan.textContent = counts[modelId] || 0;
}

function incrementGameCount(modelId) {
    if (!modelId) return;
    const counts = getGameCounts();
    counts[modelId] = (counts[modelId] || 0) + 1;
    localStorage.setItem('connect4AICounts', JSON.stringify(counts));
    updateGameStats(modelId);
}