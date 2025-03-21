import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';

// Rest of your code...

document.addEventListener('DOMContentLoaded', () => {
  // Reference to the start button and screen
  const startButton = document.getElementById('start-button');
  const startScreen = document.getElementById('start-screen');

  // Only start the game when the button is clicked
  if (startButton) {
    startButton.addEventListener('click', () => {
      // Hide the start screen
      if (startScreen) {
        startScreen.style.display = 'none';
      }
      
      // Initialize the game
      init();
    });
  } else {
    console.error('Start button not found!');
  }
});

// Global variables
let scene, camera, renderer;
let player1, player2;
let currentWeapon1, currentWeapon2;
let drawingCanvas, drawingContext;
let gameState = 'drawing'; // States: 'drawing', 'fighting', 'results'
let roundTimer = 30; // seconds
let drawingTimer = 15; // seconds
let currentPlayer = 1; // 1 or 2
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Initialize the game
function init() {
  // Setup Three.js scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb7e2f0);
  
  // Setup camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;
  
  // Setup renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  
  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0, 10, 5);
  scene.add(directionalLight);
  
  // Create players
  createPlayers();
  
  // Setup drawing canvas
  setupDrawingCanvas();
  
  // Add event listeners for controls
  setupControls();
  
  // Start game loop
  animate();
  
  // Start with drawing phase
  startDrawingPhase();
}

// Create stick figure players
function createPlayers() {
  player1 = createStickFigure();
  player1.position.x = -2;
  scene.add(player1);
  
  player2 = createStickFigure();
  player2.position.x = 2;
  scene.add(player2);
}

// Create a stick figure
function createStickFigure() {
  const figure = new THREE.Group();
  
  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 16),
    new THREE.MeshLambertMaterial({ color: 0x000000 })
  );
  head.position.y = 1.5;
  figure.add(head);
  
  // Body
  const bodyGeometry = new THREE.BufferGeometry();
  const bodyMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 3 });
  
  // Body line
  const bodyPoints = [
    new THREE.Vector3(0, 1.5, 0), // Neck
    new THREE.Vector3(0, 0.5, 0)  // Bottom of torso
  ];
  bodyGeometry.setFromPoints(bodyPoints);
  const body = new THREE.Line(bodyGeometry, bodyMaterial);
  figure.add(body);
  
  // Arms
  const armsGeometry = new THREE.BufferGeometry();
  const armPoints = [
    new THREE.Vector3(-0.5, 1.2, 0), // Left arm
    new THREE.Vector3(0, 1.3, 0),    // Shoulders
    new THREE.Vector3(0.5, 1.2, 0)   // Right arm
  ];
  armsGeometry.setFromPoints(armPoints);
  const arms = new THREE.Line(armsGeometry, bodyMaterial);
  figure.add(arms);
  
  // Legs
  const legsGeometry = new THREE.BufferGeometry();
  const legPoints = [
    new THREE.Vector3(-0.3, 0, 0),  // Left foot
    new THREE.Vector3(0, 0.5, 0),   // Hip
    new THREE.Vector3(0.3, 0, 0)    // Right foot
  ];
  legsGeometry.setFromPoints(legPoints);
  const legs = new THREE.Line(legsGeometry, bodyMaterial);
  figure.add(legs);
  
  return figure;
}

// Setup drawing canvas for weapon creation
function setupDrawingCanvas() {
  drawingCanvas = document.createElement('canvas');
  drawingCanvas.width = 400;
  drawingCanvas.height = 300;
  drawingCanvas.style.position = 'absolute';
  drawingCanvas.style.top = '50%';
  drawingCanvas.style.left = '50%';
  drawingCanvas.style.transform = 'translate(-50%, -50%)';
  drawingCanvas.style.border = '3px solid black';
  drawingCanvas.style.backgroundColor = 'white';
  drawingCanvas.style.display = 'none';
  document.body.appendChild(drawingCanvas);
  
  drawingContext = drawingCanvas.getContext('2d');
  
  // Drawing event listeners
  let isDrawing = false;
  
  const startDrawing = (e) => {
    isDrawing = true;
    draw(e);
  };
  
  const stopDrawing = () => {
    isDrawing = false;
    drawingContext.beginPath();
  };
  
  const draw = (e) => {
    if (!isDrawing) return;
    
    drawingContext.lineWidth = 5;
    drawingContext.lineCap = 'round';
    drawingContext.strokeStyle = 'black';
    
    // Get proper coordinates whether it's touch or mouse
    let x, y;
    if (e.type.includes('touch')) {
      x = e.touches[0].clientX - drawingCanvas.getBoundingClientRect().left;
      y = e.touches[0].clientY - drawingCanvas.getBoundingClientRect().top;
    } else {
      x = e.clientX - drawingCanvas.getBoundingClientRect().left;
      y = e.clientY - drawingCanvas.getBoundingClientRect().top;
    }
    
    drawingContext.lineTo(x, y);
    drawingContext.stroke();
    drawingContext.beginPath();
    drawingContext.moveTo(x, y);
  };
  
  // Mouse events
  drawingCanvas.addEventListener('mousedown', startDrawing);
  drawingCanvas.addEventListener('mouseup', stopDrawing);
  drawingCanvas.addEventListener('mousemove', draw);
  drawingCanvas.addEventListener('mouseout', stopDrawing);
  
  // Touch events for mobile
  drawingCanvas.addEventListener('touchstart', startDrawing);
  drawingCanvas.addEventListener('touchend', stopDrawing);
  drawingCanvas.addEventListener('touchmove', draw);
}

// Setup control listeners
function setupControls() {
  // Keyboard controls for movement
  document.addEventListener('keydown', (e) => {
    if (gameState !== 'fighting') return;
    
    const moveSpeed = 0.1;
    
    // Player 1 controls (WASD)
    if (e.key === 'w' || e.key === 'W') {
      player1.position.y += moveSpeed;
    } else if (e.key === 's' || e.key === 'S') {
      player1.position.y -= moveSpeed;
    } else if (e.key === 'a' || e.key === 'A') {
      player1.position.x -= moveSpeed;
    } else if (e.key === 'd' || e.key === 'D') {
      player1.position.x += moveSpeed;
    }
    
    // Player 2 controls (Arrow keys)
    if (e.key === 'ArrowUp') {
      player2.position.y += moveSpeed;
    } else if (e.key === 'ArrowDown') {
      player2.position.y -= moveSpeed;
    } else if (e.key === 'ArrowLeft') {
      player2.position.x -= moveSpeed;
    } else if (e.key === 'ArrowRight') {
      player2.position.x += moveSpeed;
    }
  });
  
  // Mouse/touch attack controls
  if (isMobile) {
    // Touch controls for mobile
    document.addEventListener('touchstart', handleAttack);
    
    // Setup gyroscope for movement if available
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleGyroscope);
    }
  } else {
    // Mouse controls for desktop
    document.addEventListener('mousedown', handleAttack);
    document.addEventListener('mousemove', handleWeaponAim);
  }
}

// Handle gyroscope input for mobile movement
function handleGyroscope(e) {
  if (gameState !== 'fighting') return;
  
  const moveSpeed = 0.05;
  
  // Current player based on turn
  const activePlayer = currentPlayer === 1 ? player1 : player2;
  
  // Move based on device tilt
  if (e.beta) { // Forward/backward tilt
    activePlayer.position.y += moveSpeed * (e.beta - 45) / 45;
  }
  
  if (e.gamma) { // Left/right tilt
    activePlayer.position.x += moveSpeed * e.gamma / 45;
  }
  
  // Keep player within bounds
  activePlayer.position.x = Math.max(Math.min(activePlayer.position.x, 4), -4);
  activePlayer.position.y = Math.max(Math.min(activePlayer.position.y, 2), -2);
}

// Handle weapon aiming
function handleWeaponAim(e) {
  if (gameState !== 'fighting') return;
  
  // Current player's weapon
  const weapon = currentPlayer === 1 ? currentWeapon1 : currentWeapon2;
  if (!weapon) return;
  
  // Calculate angle to point weapon at mouse
  const mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  const mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  
  const player = currentPlayer === 1 ? player1 : player2;
  
  // Convert mouse position to angle
  const angle = Math.atan2(mouseY - player.position.y, mouseX - player.position.x);
  
  // Rotate weapon to aim at mouse
  weapon.rotation.z = angle;
}

// Handle attack action (mouse click or touch)
function handleAttack(e) {
  if (gameState !== 'fighting') return;
  
  const weapon = currentPlayer === 1 ? currentWeapon1 : currentWeapon2;
  const opponent = currentPlayer === 1 ? player2 : player1;
  
  if (!weapon) return;
  
  // For projectile weapons: create and fire a projectile
  if (weapon.userData.type === 'projectile') {
    fireProjectile(weapon, opponent);
  } 
  // For melee weapons: check if in range and deal damage
  else {
    performMeleeAttack(weapon, opponent);
  }
}

// Fire a projectile from the weapon
function fireProjectile(weapon, target) {
  const player = currentPlayer === 1 ? player1 : player2;
  
  // Create projectile
  const projectile = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  
  // Set starting position at weapon
  projectile.position.copy(weapon.position);
  projectile.position.add(player.position);
  
  // Set direction based on weapon rotation
  const direction = new THREE.Vector3(
    Math.cos(weapon.rotation.z),
    Math.sin(weapon.rotation.z),
    0
  ).normalize();
  
  // Add to scene
  scene.add(projectile);
  
  // Store projectile data
  projectile.userData = {
    direction: direction,
    speed: 0.15,
    damage: 10,
    lifetime: 100 // frames
  };
  
  // Add to projectiles array to update in animation loop
  projectiles.push(projectile);
}

// Melee attack logic
function performMeleeAttack(weapon, opponent) {
  const player = currentPlayer === 1 ? player1 : player2;
  
  // Calculate distance between player and opponent
  const distance = player.position.distanceTo(opponent.position);
  
  // Check if in range (weapon length + small buffer)
  const weaponLength = weapon.scale.x;
  if (distance < weaponLength + 0.5) {
    // Deal damage
    opponent.userData.health -= 15;
    
    // Visual feedback - flash opponent red
    opponent.children.forEach(part => {
      if (part.material) {
        const originalColor = part.material.color.clone();
        part.material.color.set(0xff0000);
        
        setTimeout(() => {
          part.material.color.copy(originalColor);
        }, 200);
      }
    });
    
    // Check if opponent is defeated
    if (opponent.userData.health <= 0) {
      endRound(currentPlayer);
    }
  }
}

// Start the drawing phase
function startDrawingPhase() {
  gameState = 'drawing';
  
  // Show drawing interface
  drawingCanvas.style.display = 'block';
  
  // Clear previous drawing
  drawingContext.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  
  // Show instructions
  const instructions = document.createElement('div');
  instructions.style.position = 'absolute';
  instructions.style.top = '20px';
  instructions.style.left = '50%';
  instructions.style.transform = 'translateX(-50%)';
  instructions.style.fontSize = '24px';
  instructions.style.fontFamily = 'Arial, sans-serif';
  instructions.style.color = 'black';
  instructions.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
  instructions.style.padding = '10px';
  instructions.style.borderRadius = '5px';
  instructions.id = 'instructions';
  instructions.textContent = `Player ${currentPlayer}: Draw your weapon! (${drawingTimer}s)`;
  document.body.appendChild(instructions);
  
  // Add confirm button
  const confirmButton = document.createElement('button');
  confirmButton.style.position = 'absolute';
  confirmButton.style.bottom = '20px';
  confirmButton.style.left = '50%';
  confirmButton.style.transform = 'translateX(-50%)';
  confirmButton.style.padding = '10px 20px';
  confirmButton.style.fontSize = '18px';
  confirmButton.style.backgroundColor = '#4CAF50';
  confirmButton.style.color = 'white';
  confirmButton.style.border = 'none';
  confirmButton.style.borderRadius = '5px';
  confirmButton.style.cursor = 'pointer';
  confirmButton.id = 'confirmButton';
  confirmButton.textContent = 'Confirm Weapon';
  document.body.appendChild(confirmButton);
  
  // Timer for drawing phase
  let timeLeft = drawingTimer;
  const timerInterval = setInterval(() => {
    timeLeft--;
    const instructionsElement = document.getElementById('instructions');
    if (instructionsElement) {
      instructionsElement.textContent = `Player ${currentPlayer}: Draw your weapon! (${timeLeft}s)`;
    }
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      confirmDrawing();
    }
  }, 1000);
  
  // Confirm button click handler
  confirmButton.addEventListener('click', () => {
    clearInterval(timerInterval);
    confirmDrawing();
  });
}

// Process the drawn weapon
function confirmDrawing() {
  // Remove UI elements
  drawingCanvas.style.display = 'none';
  const instructionsElement = document.getElementById('instructions');
  const confirmButton = document.getElementById('confirmButton');
  
  if (instructionsElement) instructionsElement.remove();
  if (confirmButton) confirmButton.remove();
  
  // Convert drawing to texture
  const texture = new THREE.CanvasTexture(drawingCanvas);
  
  // Create a sprite with the drawing
  const material = new THREE.SpriteMaterial({ map: texture });
  const weaponSprite = new THREE.Sprite(material);
  
  // Scale the weapon
  weaponSprite.scale.set(1, 0.75, 1);
  
  // Determine weapon type based on shape analysis
  const weaponType = analyzeWeaponType(drawingCanvas);
  weaponSprite.userData.type = weaponType;
  
  // Position the weapon next to the player
  const player = currentPlayer === 1 ? player1 : player2;
  weaponSprite.position.set(0.5, 0, 0);
  
  // Add the weapon to the player
  player.add(weaponSprite);
  
  // Store the weapon reference
  if (currentPlayer === 1) {
    currentWeapon1 = weaponSprite;
  } else {
    currentWeapon2 = weaponSprite;
  }
  
  // Switch players or start fight
  if (currentPlayer === 1) {
    currentPlayer = 2;
    startDrawingPhase();
  } else {
    currentPlayer = 1; // Reset to player 1 for fighting
    startFightingPhase();
  }
}

// Analyze the drawn weapon to determine its type
function analyzeWeaponType(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Count pixels and determine shape characteristics
  let pixelCount = 0;
  let leftmost = canvas.width;
  let rightmost = 0;
  let topmost = canvas.height;
  let bottommost = 0;
  
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      // Check if pixel is drawn (not white)
      if (data[i] < 250 || data[i+1] < 250 || data[i+2] < 250) {
        pixelCount++;
        
        // Track boundaries
        leftmost = Math.min(leftmost, x);
        rightmost = Math.max(rightmost, x);
        topmost = Math.min(topmost, y);
        bottommost = Math.max(bottommost, y);
      }
    }
  }
  
  // Calculate aspect ratio
  const width = rightmost - leftmost;
  const height = bottommost - topmost;
  const aspectRatio = width / (height || 1); // Avoid division by zero
  
  // If long and thin, likely a projectile weapon
  if (aspectRatio > 2.5 || aspectRatio < 0.4) {
    return 'projectile';
  } else {
    return 'melee';
  }
}

// Start the fighting phase
function startFightingPhase() {
  gameState = 'fighting';
  
  // Initialize player health
  player1.userData.health = 100;
  player2.userData.health = 100;
  
  // Create health bars
  createHealthBars();
  
  // Show instructions
  const instructions = document.createElement('div');
  instructions.style.position = 'absolute';
  instructions.style.top = '20px';
  instructions.style.left = '50%';
  instructions.style.transform = 'translateX(-50%)';
  instructions.style.fontSize = '24px';
  instructions.style.fontFamily = 'Arial, sans-serif';
  instructions.style.color = 'black';
  instructions.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
  instructions.style.padding = '10px';
  instructions.style.borderRadius = '5px';
  instructions.id = 'instructions';
  instructions.textContent = `Fight! (${roundTimer}s)`;
  document.body.appendChild(instructions);
  
  // Timer for round
  let timeLeft = roundTimer;
  const timerInterval = setInterval(() => {
    timeLeft--;
    const instructionsElement = document.getElementById('instructions');
    if (instructionsElement) {
      instructionsElement.textContent = `Fight! (${timeLeft}s)`;
    }
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      
      // Determine winner based on health
      let winner = 0;
      if (player1.userData.health > player2.userData.health) {
        winner = 1;
      } else if (player2.userData.health > player1.userData.health) {
        winner = 2;
      }
      // If equal, it's a tie (winner remains 0)
      
      endRound(winner);
    }
  }, 1000);
  
  // Store interval ID to clear if round ends early
  roundTimerInterval = timerInterval;
}

// Create health bars for players
function createHealthBars() {
  // Player 1 health bar
  const healthBar1 = document.createElement('div');
  healthBar1.style.position = 'absolute';
  healthBar1.style.top = '50px';
  healthBar1.style.left = '50px';
  healthBar1.style.width = '200px';
  healthBar1.style.height = '20px';
  healthBar1.style.backgroundColor = '#ddd';
  healthBar1.style.border = '2px solid black';
  healthBar1.id = 'healthBar1';
  
  const healthFill1 = document.createElement('div');
  healthFill1.style.width = '100%';
  healthFill1.style.height = '100%';
  healthFill1.style.backgroundColor = 'green';
  healthFill1.id = 'healthFill1';
  
  healthBar1.appendChild(healthFill1);
  document.body.appendChild(healthBar1);
  
  // Player 2 health bar
  const healthBar2 = document.createElement('div');
  healthBar2.style.position = 'absolute';
  healthBar2.style.top = '50px';
  healthBar2.style.right = '50px';
  healthBar2.style.width = '200px';
  healthBar2.style.height = '20px';
  healthBar2.style.backgroundColor = '#ddd';
  healthBar2.style.border = '2px solid black';
  healthBar2.id = 'healthBar2';
  
  const healthFill2 = document.createElement('div');
  healthFill2.style.width = '100%';
  healthFill2.style.height = '100%';
  healthFill2.style.backgroundColor = 'green';
  healthFill2.id = 'healthFill2';
  
  healthBar2.appendChild(healthFill2);
  document.body.appendChild(healthBar2);
}

// Update health bars
function updateHealthBars() {
  const healthFill1 = document.getElementById('healthFill1');
  const healthFill2 = document.getElementById('healthFill2');
  
  if (healthFill1 && player1.userData.health !== undefined) {
    const healthPercent = Math.max(0, player1.userData.health);
    healthFill1.style.width = `${healthPercent}%`;
    
    // Change color based on health
    if (healthPercent > 50) {
      healthFill1.style.backgroundColor = 'green';
    } else if (healthPercent > 25) {
      healthFill1.style.backgroundColor = 'orange';
    } else {
      healthFill1.style.backgroundColor = 'red';
    }
  }
  
  if (healthFill2 && player2.userData.health !== undefined) {
    const healthPercent = Math.max(0, player2.userData.health);
    healthFill2.style.width = `${healthPercent}%`;
    
    // Change color based on health
    if (healthPercent > 50) {
      healthFill2.style.backgroundColor = 'green';
    } else if (healthPercent > 25) {
      healthFill2.style.backgroundColor = 'orange';
    } else {
      healthFill2.style.backgroundColor = 'red';
    }
  }
}

// End the round
function endRound(winner) {
  gameState = 'results';
  
  // Clear round timer if it exists
  if (roundTimerInterval) {
    clearInterval(roundTimerInterval);
  }
  
  // Remove health bars
  const healthBar1 = document.getElementById('healthBar1');
  const healthBar2 = document.getElementById('healthBar2');
  if (healthBar1) healthBar1.remove();
  if (healthBar2) healthBar2.remove();
  
  // Show results
  const results = document.createElement('div');
  results.style.position = 'absolute';
  results.style.top = '50%';
  results.style.left = '50%';
  results.style.transform = 'translate(-50%, -50%)';
  results.style.fontSize = '32px';
  results.style.fontFamily = 'Arial, sans-serif';
  results.style.color = 'black';
  results.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  results.style.padding = '20px';
  results.style.borderRadius = '10px';
  results.style.textAlign = 'center';
  
  if (winner === 0) {
    results.textContent = "It's a tie!";
  } else {
    results.textContent = `Player ${winner} wins!`;
  }
  
  // Add new round button
  const newRoundButton = document.createElement('button');
  newRoundButton.style.display = 'block';
  newRoundButton.style.margin = '20px auto 0';
  newRoundButton.style.padding = '10px 20px';
  newRoundButton.style.fontSize = '18px';
  newRoundButton.style.backgroundColor = '#4CAF50';
  newRoundButton.style.color = 'white';
  newRoundButton.style.border = 'none';
  newRoundButton.style.borderRadius = '5px';
  newRoundButton.style.cursor = 'pointer';
  newRoundButton.textContent = 'New Round';
  
  newRoundButton.addEventListener('click', () => {
    results.remove();
    resetGame();
  });
  
  results.appendChild(newRoundButton);
  document.body.appendChild(results);
}

// Reset the game for a new round
function resetGame() {
  // Remove old weapons
  if (currentWeapon1) {
    player1.remove(currentWeapon1);
    currentWeapon1 = null;
  }
  
  if (currentWeapon2) {
    player2.remove(currentWeapon2);
    currentWeapon2 = null;
  }
  
  // Reset player positions
  player1.position.set(-2, 0, 0);
  player2.position.set(2, 0, 0);
  
  // Clear projectiles
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const obj = scene.children[i];
    if (obj.userData && obj.userData.isProjectile) {
      scene.remove(obj);
    }
  }
  
  // Start a new drawing phase
  currentPlayer = 1;
  startDrawingPhase();
}

// Animation loop
let projectiles = [];
let roundTimerInterval;

function animate() {
  requestAnimationFrame(animate);
  
  // Update health bars if in fighting state
  if (gameState === 'fighting') {
    updateHealthBars();
    
    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const projectile = projectiles[i];
      
      // Move projectile
      projectile.position.x += projectile.userData.direction.x * projectile.userData.speed;
      projectile.position.y += projectile.userData.direction.y * projectile.userData.speed;
      
      // Decrease lifetime
      projectile.userData.lifetime--;
      
      // Check for collisions with players
      const p1Distance = projectile.position.distanceTo(player1.position);
      const p2Distance = projectile.position.distanceTo(player2.position);
      
      // Handle collision
      if (p1Distance < 0.3 && projectile.userData.firedBy !== 1) {
        player1.userData.health -= projectile.userData.damage;
        scene.remove(projectile);
        projectiles.splice(i, 1);
        
        // Check if player is defeated
        if (player1.userData.health <= 0) {
          endRound(2);
        }
        
        continue;
      }
      
      if (p2Distance < 0.3 && projectile.userData.firedBy !== 2) {
        player2.userData.health -= projectile.userData.damage;
        scene.remove(projectile);
        projectiles.splice(i, 1);
        
        // Check if player is defeated
        if (player2.userData.health <= 0) {
          endRound(1);
        }
        
        continue;
      }
      
      // Remove if out of bounds or lifetime ended
      if (
        projectile.position.x < -10 ||
        projectile.position.x > 10 ||
        projectile.position.y < -10 ||
        projectile.position.y > 10 ||
        projectile.userData.lifetime <= 0
      ) {
        scene.remove(projectile);
        projectiles.splice(i, 1);
      }
    }
  }
  
  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
