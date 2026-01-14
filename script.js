// ========== GAME STATE ==========
const gameState = {
  board: [],
  turn: 'white',
  selected: null,
  gameOver: false,
  whiteTime: 300,
  blackTime: 300,
  timerInterval: null,
  castlingRights: { whiteKing: true, whiteQueen: true, blackKing: true, blackQueen: true },
  enPassantSquare: null,
  moveHistory: [],
  whiteKingMoved: false,
  blackKingMoved: false,
  promotionPending: null
};

// ========== DOM ELEMENTS ==========
const modeSelection = document.getElementById('modeSelection');
const gameScreen = document.getElementById('gameScreen');
const boardElement = document.querySelector('.board');
const statusElement = document.getElementById('status');
const timerElement = document.getElementById('timer');
const resetBtn = document.getElementById('resetBtn');
const promotionModal = document.getElementById('promotionModal');

// ========== AUDIO ==========
const sounds = {
  move: new Audio('move.mp3'),
  capture: new Audio('sword.mp3'),
  win: new Audio('win.mp3')
};

// ========== INITIAL SETUP ==========
const initialBoard = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

// ========== MODE SELECTION ==========
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const timeInSeconds = parseInt(btn.dataset.time);
    startGame(timeInSeconds);
  });
});

resetBtn.addEventListener('click', () => {
  location.reload();
});

function startGame(timeInSeconds) {
  gameState.whiteTime = timeInSeconds;
  gameState.blackTime = timeInSeconds;

  modeSelection.style.display = 'none';
  gameScreen.style.display = 'block';

  initializeBoard();
  updateTimer();
  startTimer();
}

// ========== BOARD INITIALIZATION ==========
function initializeBoard() {
  gameState.board = initialBoard.map(row => [...row]);
  boardElement.innerHTML = '';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const box = document.createElement('div');
      box.className = `box ${(r + c) % 2 ? 'black' : 'white'}`;
      box.dataset.r = r;
      box.dataset.c = c;
      box.onclick = () => handleClick(r, c);

      const piece = gameState.board[r][c];
      if (piece) {
        box.innerHTML = getPieceHTML(piece);
      }

      boardElement.appendChild(box);
    }
  }
}

function getPieceHTML(piece) {
  const pieceMap = {
    r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king', p: 'pawn',
    R: 'rook', N: 'knight', B: 'bishop', Q: 'queen', K: 'king', P: 'pawn'
  };
  const color = piece === piece.toUpperCase() ? 'white-piece' : 'black-piece';
  return `<i class="fa-solid fa-chess-${pieceMap[piece]} ${color}"></i>`;
}

function getBox(r, c) {
  return boardElement.querySelector(`[data-r="${r}"][data-c="${c}"]`);
}

// ========== CLICK HANDLER ==========
function handleClick(r, c) {
  if (gameState.gameOver || gameState.promotionPending) return;

  const piece = gameState.board[r][c];

  if (!gameState.selected) {
    if (piece && isOwnPiece(piece)) {
      selectPiece(r, c);
    }
  } else {
    const [selectedR, selectedC] = gameState.selected;

    if (r === selectedR && c === selectedC) {
      deselectPiece();
    } else if (piece && isOwnPiece(piece)) {
      deselectPiece();
      selectPiece(r, c);
    } else {
      attemptMove(selectedR, selectedC, r, c);
    }
  }
}

function selectPiece(r, c) {
  gameState.selected = [r, c];
  getBox(r, c).classList.add('selected');

  const validMoves = getValidMoves(r, c);
  validMoves.forEach(([mr, mc]) => {
    const box = getBox(mr, mc);
    if (gameState.board[mr][mc]) {
      box.classList.add('valid-capture');
    } else {
      box.classList.add('valid-move');
    }
  });
}

function deselectPiece() {
  if (gameState.selected) {
    const [r, c] = gameState.selected;
    getBox(r, c).classList.remove('selected');
  }

  document.querySelectorAll('.valid-move, .valid-capture').forEach(box => {
    box.classList.remove('valid-move', 'valid-capture');
  });

  gameState.selected = null;
}

function isOwnPiece(piece) {
  return gameState.turn === 'white'
    ? piece === piece.toUpperCase()
    : piece === piece.toLowerCase();
}

// ========== MOVE EXECUTION ==========
function attemptMove(fromR, fromC, toR, toC) {
  const validMoves = getValidMoves(fromR, fromC);
  const isValid = validMoves.some(([r, c]) => r === toR && c === toC);

  if (!isValid) {
    deselectPiece();
    return;
  }

  executeMove(fromR, fromC, toR, toC);
}

function executeMove(fromR, fromC, toR, toC) {
  const piece = gameState.board[fromR][fromC];
  const captured = gameState.board[toR][toC];
  const pieceLower = piece.toLowerCase();

  // Handle castling
  if (pieceLower === 'k' && Math.abs(toC - fromC) === 2) {
    executeCastling(fromR, fromC, toR, toC);
    return;
  }

  // Handle en passant
  if (pieceLower === 'p' && toR === gameState.enPassantSquare?.[0] && toC === gameState.enPassantSquare?.[1]) {
    const capturedPawnRow = gameState.turn === 'white' ? toR + 1 : toR - 1;
    gameState.board[capturedPawnRow][toC] = '';
    getBox(capturedPawnRow, toC).innerHTML = '';
  }

  // Move piece
  gameState.board[toR][toC] = piece;
  gameState.board[fromR][fromC] = '';

  getBox(toR, toC).innerHTML = getPieceHTML(piece);
  getBox(fromR, fromC).innerHTML = '';

  // Update castling rights
  if (pieceLower === 'k') {
    if (gameState.turn === 'white') gameState.whiteKingMoved = true;
    else gameState.blackKingMoved = true;
  }
  if (pieceLower === 'r') {
    if (fromR === 7 && fromC === 0) gameState.castlingRights.whiteQueen = false;
    if (fromR === 7 && fromC === 7) gameState.castlingRights.whiteKing = false;
    if (fromR === 0 && fromC === 0) gameState.castlingRights.blackQueen = false;
    if (fromR === 0 && fromC === 7) gameState.castlingRights.blackKing = false;
  }

  // Set en passant square
  if (pieceLower === 'p' && Math.abs(toR - fromR) === 2) {
    gameState.enPassantSquare = [(fromR + toR) / 2, toC];
  } else {
    gameState.enPassantSquare = null;
  }

  // Play sound
  if (captured) {
    sounds.capture.play().catch(() => { });
  } else {
    sounds.move.play().catch(() => { });
  }

  deselectPiece();

  // Check for pawn promotion
  if (pieceLower === 'p' && (toR === 0 || toR === 7)) {
    gameState.promotionPending = [toR, toC];
    showPromotionModal();
    return;
  }

  switchTurn();
}

function executeCastling(fromR, fromC, toR, toC) {
  const piece = gameState.board[fromR][fromC];

  // Move king
  gameState.board[toR][toC] = piece;
  gameState.board[fromR][fromC] = '';
  getBox(toR, toC).innerHTML = getPieceHTML(piece);
  getBox(fromR, fromC).innerHTML = '';

  // Move rook
  if (toC > fromC) { // Kingside
    const rook = gameState.board[fromR][7];
    gameState.board[fromR][5] = rook;
    gameState.board[fromR][7] = '';
    getBox(fromR, 5).innerHTML = getPieceHTML(rook);
    getBox(fromR, 7).innerHTML = '';
  } else { // Queenside
    const rook = gameState.board[fromR][0];
    gameState.board[fromR][3] = rook;
    gameState.board[fromR][0] = '';
    getBox(fromR, 3).innerHTML = getPieceHTML(rook);
    getBox(fromR, 0).innerHTML = '';
  }

  if (gameState.turn === 'white') gameState.whiteKingMoved = true;
  else gameState.blackKingMoved = true;

  sounds.move.play().catch(() => { });
  deselectPiece();
  switchTurn();
}

// ========== PAWN PROMOTION ==========
function showPromotionModal() {
  promotionModal.style.display = 'flex';

  const choices = promotionModal.querySelectorAll('.promotion-btn');
  choices.forEach(btn => {
    const piece = btn.dataset.piece;

    // Clone button to remove old event listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    // Update piece color on the cloned button
    const icon = newBtn.querySelector('i');
    icon.className = `fa-solid fa-chess-${getPieceName(piece)} ${gameState.turn === 'white' ? 'white-piece' : 'black-piece'}`;

    // Add click event listener
    newBtn.addEventListener('click', function handlePromotion() {
      const selectedPiece = newBtn.dataset.piece;
      promotePawn(selectedPiece);
    });
  });
}

function getPieceName(piece) {
  const map = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };
  return map[piece];
}

function promotePawn(pieceType) {
  const [r, c] = gameState.promotionPending;
  const promotedPiece = gameState.turn === 'white' ? pieceType.toUpperCase() : pieceType.toLowerCase();

  gameState.board[r][c] = promotedPiece;
  getBox(r, c).innerHTML = getPieceHTML(promotedPiece);

  promotionModal.style.display = 'none';
  gameState.promotionPending = null;

  switchTurn();
}

// ========== TURN MANAGEMENT ==========
function switchTurn() {
  gameState.turn = gameState.turn === 'white' ? 'black' : 'white';
  statusElement.textContent = `${gameState.turn.toUpperCase()} TURN`;

  // Check for checkmate or stalemate
  if (isCheckmate(gameState.turn)) {
    const winner = gameState.turn === 'white' ? 'BLACK' : 'WHITE';
    endGame(`${winner} WINS - CHECKMATE!`);
  } else if (isStalemate(gameState.turn)) {
    endGame('STALEMATE - DRAW!');
  } else if (isInCheck(gameState.turn)) {
    statusElement.classList.add('in-check');
  } else {
    statusElement.classList.remove('in-check');
  }
}

// ========== TIMER ==========
function startTimer() {
  gameState.timerInterval = setInterval(() => {
    if (gameState.promotionPending) return;

    if (gameState.turn === 'white') {
      gameState.whiteTime--;
      if (gameState.whiteTime <= 0) {
        endGame('BLACK WINS - TIME OUT!');
      }
    } else {
      gameState.blackTime--;
      if (gameState.blackTime <= 0) {
        endGame('WHITE WINS - TIME OUT!');
      }
    }

    updateTimer();
  }, 1000);
}

function updateTimer() {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  timerElement.textContent = `${formatTime(gameState.whiteTime)} | ${formatTime(gameState.blackTime)}`;
}

// ========== GAME END ==========
function endGame(message) {
  gameState.gameOver = true;
  clearInterval(gameState.timerInterval);

  sounds.win.play().catch(() => { });

  const resultDiv = document.createElement('div');
  resultDiv.className = 'result';
  resultDiv.innerHTML = `<div><h1>${message}</h1></div>`;
  document.body.appendChild(resultDiv);
}

// ========== CHESS RULES ENGINE ==========

function getValidMoves(r, c) {
  const piece = gameState.board[r][c];
  if (!piece) return [];

  const pieceLower = piece.toLowerCase();
  let possibleMoves = [];

  switch (pieceLower) {
    case 'p': possibleMoves = getPawnMoves(r, c); break;
    case 'n': possibleMoves = getKnightMoves(r, c); break;
    case 'b': possibleMoves = getBishopMoves(r, c); break;
    case 'r': possibleMoves = getRookMoves(r, c); break;
    case 'q': possibleMoves = getQueenMoves(r, c); break;
    case 'k': possibleMoves = getKingMoves(r, c); break;
  }

  // Filter out moves that would leave king in check
  return possibleMoves.filter(([toR, toC]) => {
    return !wouldBeInCheck(r, c, toR, toC);
  });
}

function getPawnMoves(r, c) {
  const moves = [];
  const piece = gameState.board[r][c];
  const direction = piece === piece.toUpperCase() ? -1 : 1;
  const startRow = piece === piece.toUpperCase() ? 6 : 1;

  // Forward move
  if (isInBounds(r + direction, c) && !gameState.board[r + direction][c]) {
    moves.push([r + direction, c]);

    // Double move from start
    if (r === startRow && !gameState.board[r + 2 * direction][c]) {
      moves.push([r + 2 * direction, c]);
    }
  }

  // Captures
  for (const dc of [-1, 1]) {
    const newR = r + direction;
    const newC = c + dc;
    if (isInBounds(newR, newC)) {
      const target = gameState.board[newR][newC];
      if (target && isOpponentPiece(piece, target)) {
        moves.push([newR, newC]);
      }

      // En passant
      if (gameState.enPassantSquare && gameState.enPassantSquare[0] === newR && gameState.enPassantSquare[1] === newC) {
        moves.push([newR, newC]);
      }
    }
  }

  return moves;
}

function getKnightMoves(r, c) {
  const moves = [];
  const offsets = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];

  for (const [dr, dc] of offsets) {
    const newR = r + dr;
    const newC = c + dc;
    if (isInBounds(newR, newC) && canMoveTo(r, c, newR, newC)) {
      moves.push([newR, newC]);
    }
  }

  return moves;
}

function getBishopMoves(r, c) {
  return getSlidingMoves(r, c, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
}

function getRookMoves(r, c) {
  return getSlidingMoves(r, c, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
}

function getQueenMoves(r, c) {
  return getSlidingMoves(r, c, [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]);
}

function getSlidingMoves(r, c, directions) {
  const moves = [];

  for (const [dr, dc] of directions) {
    let newR = r + dr;
    let newC = c + dc;

    while (isInBounds(newR, newC)) {
      if (!gameState.board[newR][newC]) {
        moves.push([newR, newC]);
      } else {
        if (canMoveTo(r, c, newR, newC)) {
          moves.push([newR, newC]);
        }
        break;
      }
      newR += dr;
      newC += dc;
    }
  }

  return moves;
}

function getKingMoves(r, c) {
  const moves = [];
  const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  for (const [dr, dc] of offsets) {
    const newR = r + dr;
    const newC = c + dc;
    if (isInBounds(newR, newC) && canMoveTo(r, c, newR, newC)) {
      moves.push([newR, newC]);
    }
  }

  // Castling
  const piece = gameState.board[r][c];
  const isWhite = piece === piece.toUpperCase();

  if ((isWhite && !gameState.whiteKingMoved) || (!isWhite && !gameState.blackKingMoved)) {
    if (!isInCheck(gameState.turn)) {
      // Kingside castling
      if (canCastle(r, c, r, c + 2, true)) {
        moves.push([r, c + 2]);
      }
      // Queenside castling
      if (canCastle(r, c, r, c - 2, false)) {
        moves.push([r, c - 2]);
      }
    }
  }

  return moves;
}

function canCastle(fromR, fromC, toR, toC, isKingside) {
  const piece = gameState.board[fromR][fromC];
  const isWhite = piece === piece.toUpperCase();

  // Check castling rights
  if (isWhite) {
    if (isKingside && !gameState.castlingRights.whiteKing) return false;
    if (!isKingside && !gameState.castlingRights.whiteQueen) return false;
  } else {
    if (isKingside && !gameState.castlingRights.blackKing) return false;
    if (!isKingside && !gameState.castlingRights.blackQueen) return false;
  }

  // Check if squares between king and rook are empty
  const direction = isKingside ? 1 : -1;
  const rookCol = isKingside ? 7 : 0;
  const squaresToCheck = isKingside ? 2 : 3;

  for (let i = 1; i <= squaresToCheck; i++) {
    if (gameState.board[fromR][fromC + i * direction]) return false;
  }

  // Check if rook is in place
  const rook = gameState.board[fromR][rookCol];
  if (!rook || rook.toLowerCase() !== 'r') return false;

  // Check if king passes through check
  for (let c = fromC; c !== toC + direction; c += direction) {
    if (isSquareAttacked(fromR, c, isWhite ? 'black' : 'white')) return false;
  }

  return true;
}

// ========== HELPER FUNCTIONS ==========

function isInBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function canMoveTo(fromR, fromC, toR, toC) {
  const piece = gameState.board[fromR][fromC];
  const target = gameState.board[toR][toC];

  if (!target) return true;
  return isOpponentPiece(piece, target);
}

function isOpponentPiece(piece1, piece2) {
  return (piece1 === piece1.toUpperCase()) !== (piece2 === piece2.toUpperCase());
}

function wouldBeInCheck(fromR, fromC, toR, toC) {
  // Simulate move
  const originalPiece = gameState.board[fromR][fromC];
  const capturedPiece = gameState.board[toR][toC];

  gameState.board[toR][toC] = originalPiece;
  gameState.board[fromR][fromC] = '';

  const inCheck = isInCheck(gameState.turn);

  // Undo move
  gameState.board[fromR][fromC] = originalPiece;
  gameState.board[toR][toC] = capturedPiece;

  return inCheck;
}

function isInCheck(color) {
  // Find king position
  let kingR, kingC;
  const kingPiece = color === 'white' ? 'K' : 'k';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (gameState.board[r][c] === kingPiece) {
        kingR = r;
        kingC = c;
        break;
      }
    }
  }

  return isSquareAttacked(kingR, kingC, color === 'white' ? 'black' : 'white');
}

function isSquareAttacked(r, c, byColor) {
  // Check all opponent pieces to see if they can attack this square
  for (let fr = 0; fr < 8; fr++) {
    for (let fc = 0; fc < 8; fc++) {
      const piece = gameState.board[fr][fc];
      if (!piece) continue;

      const pieceColor = piece === piece.toUpperCase() ? 'white' : 'black';
      if (pieceColor !== byColor) continue;

      const pieceLower = piece.toLowerCase();
      let canAttack = false;

      switch (pieceLower) {
        case 'p':
          const direction = piece === piece.toUpperCase() ? -1 : 1;
          canAttack = (fr + direction === r && Math.abs(fc - c) === 1);
          break;
        case 'n':
          const dr = Math.abs(fr - r);
          const dc = Math.abs(fc - c);
          canAttack = (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
          break;
        case 'b':
          canAttack = isDiagonalClear(fr, fc, r, c);
          break;
        case 'r':
          canAttack = isStraightClear(fr, fc, r, c);
          break;
        case 'q':
          canAttack = isDiagonalClear(fr, fc, r, c) || isStraightClear(fr, fc, r, c);
          break;
        case 'k':
          canAttack = Math.abs(fr - r) <= 1 && Math.abs(fc - c) <= 1;
          break;
      }

      if (canAttack) return true;
    }
  }

  return false;
}

function isDiagonalClear(fromR, fromC, toR, toC) {
  const dr = Math.abs(toR - fromR);
  const dc = Math.abs(toC - fromC);

  if (dr !== dc) return false;

  const stepR = toR > fromR ? 1 : -1;
  const stepC = toC > fromC ? 1 : -1;

  let r = fromR + stepR;
  let c = fromC + stepC;

  while (r !== toR && c !== toC) {
    if (gameState.board[r][c]) return false;
    r += stepR;
    c += stepC;
  }

  return true;
}

function isStraightClear(fromR, fromC, toR, toC) {
  if (fromR !== toR && fromC !== toC) return false;

  if (fromR === toR) {
    const start = Math.min(fromC, toC) + 1;
    const end = Math.max(fromC, toC);
    for (let c = start; c < end; c++) {
      if (gameState.board[fromR][c]) return false;
    }
  } else {
    const start = Math.min(fromR, toR) + 1;
    const end = Math.max(fromR, toR);
    for (let r = start; r < end; r++) {
      if (gameState.board[r][fromC]) return false;
    }
  }

  return true;
}

function isCheckmate(color) {
  if (!isInCheck(color)) return false;

  // Check if any move can get out of check
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = gameState.board[r][c];
      if (!piece) continue;

      const pieceColor = piece === piece.toUpperCase() ? 'white' : 'black';
      if (pieceColor !== color) continue;

      const validMoves = getValidMoves(r, c);
      if (validMoves.length > 0) return false;
    }
  }

  return true;
}

function isStalemate(color) {
  if (isInCheck(color)) return false;

  // Check if player has any legal moves
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = gameState.board[r][c];
      if (!piece) continue;

      const pieceColor = piece === piece.toUpperCase() ? 'white' : 'black';
      if (pieceColor !== color) continue;

      const validMoves = getValidMoves(r, c);
      if (validMoves.length > 0) return false;
    }
  }

  return true;
}
