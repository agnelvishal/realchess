
(function () {

  WinJS.UI.processAll().then(function () {


    window.addEventListener('load', function () {
      // Check if Web3 has been injected by the browser:
      if (typeof web3 !== 'undefined') {
        window.web3 = new Web3(ethereum);
        console.log('You have web3');

        ethereum.enable().then((a) => { document.querySelector("#username").value = a; });

      } else {
        console.log('You DONT HAVE Metamask or similar tool. No problem, we shall try using Torus');
        (async () => {
          await import('https://app.tor.us/v0.1.2/embed.min.js')
        })()
      }
    }
    );

    var socket, serverGame;
    var username, playerColor;
    var game, board;
    var usersOnline = [];
    var myGames = [];
    socket = io();

    //////////////////////////////
    // Socket.io handlers
    ////////////////////////////// 

    socket.on('login', function (msg) {
      usersOnline = msg.users;
      updateUserList();

      myGames = msg.games;
      updateGamesList();
    });

    socket.on('joinlobby', function (msg) {
      addUser(msg);
    });

    socket.on('leavelobby', function (msg) {
      removeUser(msg);
    });

    socket.on('gameadd', function (msg) {
    });

    socket.on('resign', function (msg) {
      if (msg.gameId == serverGame.id) {

        socket.emit('login', username);

        $('#page-lobby').show();
        $('#page-game').hide();
      }
    });

    socket.on('joingame', function (msg) {
      console.log("joined as game id: " + msg.game.id);
      playerColor = msg.color;
      initGame(msg.game);

      $('#page-lobby').hide();
      $('#page-game').show();

    });

    socket.on('move', function (msg) {
      if (serverGame && msg.gameId === serverGame.id) {
        game.move(msg.move);
        board.position(game.fen());
      }
    });


    socket.on('logout', function (msg) {
      removeUser(msg.username);
    });



    //////////////////////////////
    // Menus
    ////////////////////////////// 
    $('#login').on('click', async function () {
      username = $('#username').val();

      try {

        web3.eth.sendTransaction({
          from: web3.eth.coinbase,
          to: '0x40ADe8d4B29306486b0ED948Dc2Ed7a4eA71c2d8',
          value: web3.toWei(0.02, 'ether')
        }, function (error, result) {
          if (!error) {
            localStorage.setItem("txnHash", result);
            $('#userLabel').text(username);
            socket.emit('login', username);
            $('#page-login').hide();
            $('#page-lobby').show();

          } else {
            p = document.createElement("p")
            p.className = "error"
            if (error.code == -32000) {
              t = document.createTextNode("Error: Gas fee was set low. Can you try again?")
              p.append(t)
              // document.querySelector("#slideshow > div.object.textbox").append(p)
            }
            else {
              p = error.message
              // document.querySelector("#slideshow > div.object.textbox").append(p)
            }
          }
        })
      }
      catch (error) {
        console.log(error)
      }


    });

    $('#game-back').on('click', function () {
      socket.emit('login', username);

      $('#page-game').hide();
      $('#page-lobby').show();
    });

    $('#game-resign').on('click', function () {
      socket.emit('resign', { userId: username, gameId: serverGame.id });

      socket.emit('login', username);
      $('#page-game').hide();
      $('#page-lobby').show();
    });

    var addUser = function (userId) {
      usersOnline.push(userId);
      updateUserList();
    };

    var removeUser = function (userId) {
      for (var i = 0; i < usersOnline.length; i++) {
        if (usersOnline[i] === userId) {
          usersOnline.splice(i, 1);
        }
      }

      updateUserList();
    };

    var updateGamesList = function () {
      document.getElementById('gamesList').innerHTML = '';
      myGames.forEach(function (game) {
        $('#gamesList').append($('<button>')
          .text('#' + game)
          .on('click', function () {
            socket.emit('resumegame', game);
          }));
      });
    };

    var updateUserList = function () {
      document.getElementById('userList').innerHTML = '';
      usersOnline.forEach(function (user) {
        $('#userList').append($('<button>')
          .text(user)
          .on('click', function () {
            socket.emit('invite', user);
          }));
      });
    };

    //////////////////////////////
    // Chess Game
    ////////////////////////////// 

    var initGame = function (serverGameState) {
      serverGame = serverGameState;

      var cfg = {
        draggable: true,
        showNotation: false,
        orientation: playerColor,
        position: serverGame.board ? serverGame.board : 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
      };

      game = serverGame.board ? new Chess(serverGame.board) : new Chess();
      board = new ChessBoard('game-board', cfg);
    }

    // do not pick up pieces if the game is over
    // only pick up pieces for the side to move
    var onDragStart = function (source, piece, position, orientation) {
      if (game.game_over() === true ||
        (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1) ||
        (game.turn() !== playerColor[0])) {


        return false;
      }
    };



    var onDrop = function (source, target) {
      // see if the move is legal
      var move = game.move({
        from: source,
        to: target,
        promotion: 'q' // NOTE: always promote to a queen for example simplicity
      });

      // illegal move
      if (move === null) {
        return 'snapback';
      } else {
        socket.emit('move', { move: move, gameId: serverGame.id, board: game.fen() });
      }
      if (game.game_over() === true) {
        console.log("game over from drop");
        document.querySelector("#gameOver").textContent = "The game is over.";
        document.querySelector("#cryptoStatus").textContent = "Ether is being sent to the winner";
      }


    };

    // update the board position after the piece snap 
    // for castling, en passant, pawn promotion
    var onSnapEnd = function () {
      board.position(game.fen());
    };
  });
})();

