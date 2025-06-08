const ROWS_MM = 6;
const COLS_MM = 7;
const CONNECT_N_MM = 4;
const AI_PLAYER_MM = -1;
const HUMAN_PLAYER_MM = 1;

/**
 * Creates a deep copy of the board for simulation.
 * @param {number[][]} board The game board.
 * @returns {number[][]} A new copy of the board.
 */
function copyBoard(board) {
    return board.map(row => [...row]);
}

/**
 * Scores a 4-cell window. Ported from heuristic.py.
 * @param {number} p_count Player's pieces in window.
 * @param {number} o_count Opponent's pieces in window.
 * @param {number} e_count Empty cells in window.
 * @returns {number} The score for this window.
 */
function scoreWindow(p_count, o_count, e_count) {
    if (p_count === 4) return 100000.0;
    if (p_count === 3 && e_count === 1) return 10.0;
    if (p_count === 2 && e_count === 2) return 3.0;
    if (o_count === 4) return -1000000.0;
    if (o_count === 3 && e_count === 1) return -50.0;
    if (o_count === 2 && e_count === 2) return -3.0;
    return 0.0;
}

/**
 * Evaluates the entire board from the perspective of a given player.
 * @param {number[][]} board The game board.
 * @param {number} player The player to evaluate for (1 or -1).
 * @returns {number} The total board score.
 */
function evaluateBoard(board, player) {
    let score = 0.0;
    const opponent = -player;

    const centerColIndex = Math.floor(COLS_MM / 2);
    for (let r = 0; r < ROWS_MM; r++) {
        if (board[r][centerColIndex] === player) score += 3.0;
        else if (board[r][centerColIndex] === opponent) score -= 3.0;
    }

    const checkWindow = (window) => {
        let p_count = 0, o_count = 0;
        for (const piece of window) {
            if (piece === player) p_count++;
            else if (piece === opponent) o_count++;
        }
        score += scoreWindow(p_count, o_count, 4 - p_count - o_count);
    };

    for (let r = 0; r < ROWS_MM; r++) {
        for (let c = 0; c < COLS_MM; c++) {
            if (c <= COLS_MM - 4) checkWindow([board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]]);
            if (r <= ROWS_MM - 4) checkWindow([board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]]);
            if (r <= ROWS_MM - 4 && c <= COLS_MM - 4) checkWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]]);
            if (r >= 3 && c <= COLS_MM - 4) checkWindow([board[r][c], board[r-1][c+1], board[r-2][c+2], board[r-3][c+3]]);
        }
    }
    return score;
}

/**
 * Checks if a player has a 4-in-a-row win. This is deterministic.
 * @param {number[][]} board The game board.
 * @param {number} player The player to check for a win.
 * @returns {boolean} True if the player has won.
 */
function checkForWin(board, player) {
    // Check horizontal
    for (let r = 0; r < ROWS_MM; r++) {
        for (let c = 0; c <= COLS_MM - 4; c++) {
            if (board[r][c] === player && board[r][c+1] === player && board[r][c+2] === player && board[r][c+3] === player) {
                return true;
            }
        }
    }
    // Check vertical
    for (let c = 0; c < COLS_MM; c++) {
        for (let r = 0; r <= ROWS_MM - 4; r++) {
            if (board[r][c] === player && board[r+1][c] === player && board[r+2][c] === player && board[r+3][c] === player) {
                return true;
            }
        }
    }
    // Check positive diagonal
    for (let r = 0; r <= ROWS_MM - 4; r++) {
        for (let c = 0; c <= COLS_MM - 4; c++) {
            if (board[r][c] === player && board[r+1][c+1] === player && board[r+2][c+2] === player && board[r+3][c+3] === player) {
                return true;
            }
        }
    }
    // Check negative diagonal
    for (let r = 3; r < ROWS_MM; r++) {
        for (let c = 0; c <= COLS_MM - 4; c++) {
            if (board[r][c] === player && board[r-1][c+1] === player && board[r-2][c+2] === player && board[r-3][c+3] === player) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Checks if the game has reached a terminal state (win for either player, or a draw).
 * @param {number[][]} board The game board.
 * @returns {boolean} True if the game is over.
 */
function isTerminalNode(board) {
    return checkForWin(board, AI_PLAYER_MM) || 
           checkForWin(board, HUMAN_PLAYER_MM) || 
           getLegalActions(board).length === 0;
}


function getLegalActions(board) {
    const legal = [];
    for (let c = 0; c < COLS_MM; c++) {
        if (board[ROWS_MM - 1][c] === 0) legal.push(c);
    }
    return legal;
}

function makeSimulatedMove(board, col, player) {
    if (board[ROWS_MM - 1][col] !== 0) return null;
    const newBoard = copyBoard(board);
    for (let r = 0; r < ROWS_MM; r++) {
        if (newBoard[r][col] === 0) {
            newBoard[r][col] = player;
            return newBoard;
        }
    }
    return null;
}

function alphabeta(board, depth, alpha, beta, maximizingPlayer) {
    if (depth === 0 || isTerminalNode(board)) {
        return { score: evaluateBoard(board, AI_PLAYER_MM), move: null };
    }

    // This sorting is for alpha-beta pruning efficiency, not for final move choice.
    const legalActions = getLegalActions(board);
    legalActions.sort((a, b) => Math.abs(a - Math.floor(COLS_MM / 2)) - Math.abs(b - Math.floor(COLS_MM / 2)));
    
    let bestMove = legalActions[0];

    if (maximizingPlayer) {
        let value = -Infinity;
        for (const move of legalActions) {
            const newBoard = makeSimulatedMove(board, move, AI_PLAYER_MM);
            if (!newBoard) continue;
            const { score: newScore } = alphabeta(newBoard, depth - 1, alpha, beta, false);
            if (newScore > value) {
                value = newScore;
                bestMove = move;
            }
            alpha = Math.max(alpha, value);
            if (alpha >= beta) break;
        }
        return { score: value, move: bestMove };
    } else { // Minimizing player
        let value = Infinity;
        for (const move of legalActions) {
            const newBoard = makeSimulatedMove(board, move, HUMAN_PLAYER_MM);
            if (!newBoard) continue;
            const { score: newScore } = alphabeta(newBoard, depth - 1, alpha, beta, true);
            if (newScore < value) {
                value = newScore;
                bestMove = move;
            }
            beta = Math.min(beta, value);
            if (beta <= alpha) break;
        }
        return { score: value, move: bestMove };
    }
}

function getMinimaxMove(board, depth) {
    const legalActions = getLegalActions(board);
    if (legalActions.length === 0) return null;

    // Greedy checks for immediate win/loss
    for (const move of legalActions) {
        const tempBoard = makeSimulatedMove(board, move, AI_PLAYER_MM);
        if (tempBoard && checkForWin(tempBoard, AI_PLAYER_MM)) {
            console.log(`AI found immediate win in column ${move}.`);
            return move;
        }
    }
    for (const move of legalActions) {
        const tempBoard = makeSimulatedMove(board, move, HUMAN_PLAYER_MM);
        if (tempBoard && checkForWin(tempBoard, HUMAN_PLAYER_MM)) {
            console.log(`AI must block player's winning move in column ${move}.`);
            return move;
        }
    }
    
    // If scores are tied, the move closest to the center is chosen.
    const center = Math.floor(COLS_MM / 2);
    legalActions.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));

    let moveScores = [];
    let bestScore = -Infinity;
    let bestMove = legalActions[0]; // The default is now the most central move

    for (const move of legalActions) {
        const newBoard = makeSimulatedMove(board, move, AI_PLAYER_MM);
        if (!newBoard) continue;
        
        const result = alphabeta(newBoard, depth - 1, -Infinity, Infinity, false);
        const score = result.score;
        
        moveScores.push({ move: move, score: score });
        
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    
    console.log(`--- Alpha-Beta Search Results (Depth: ${depth}) ---`);
    moveScores.sort((a, b) => b.score - a.score);
    console.table(moveScores);
    console.log(`%cAI chose move: ${bestMove} (score: ${bestScore.toFixed(2)})`, 'font-weight: bold; color: blue;');

    return bestMove;
}   