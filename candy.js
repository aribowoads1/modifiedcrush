
var candies = ["Blue", "Orange", "Green", "Yellow", "Red", "Purple"];
var board = [];
var rows = 9;
var columns = 9;
var score = 0;

var currTile;
var otherTile;
var muted = false;

// ===================== SOUND MANAGER =====================
// Suara dipetakan berdasarkan sifatnya (lihat folder sound/):
// - bgm (jazz cafe): musik latar lembut (loop, volume pelan)
// - switch         : whoosh senang -> swap valid
// - negative_switch: nada "ditolak" -> swap tidak valid
// - combo 1..12    : nada naik sesuai jumlah -> rantai cascade makin dalam
// - sweet/tasty/delicious/divine : voice callout untuk cascade besar
// - button_press   : klik tombol
var sounds = {};

function loadSounds() {
    let files = [
        "switch_sound1", "negative_switch_sound1",
        "combo_sound1", "combo_sound2", "combo_sound3", "combo_sound4",
        "combo_sound5", "combo_sound6", "combo_sound7", "combo_sound8",
        "combo_sound9", "combo_sound10", "combo_sound11", "combo_sound12",
        "sweet", "tasty", "delicious", "divine", "button_press"
    ];
    for (let name of files) {
        let audio = new Audio("./sound/" + name + ".wav");
        audio.preload = "auto";
        sounds[name] = audio;
    }

    //musik latar: jazz cafe yang lembut (format mp3, file lokal di folder sound/)
    let bgm = new Audio("./sound/alex-morgan-jazz-cafe-morning-music-556238.mp3");
    bgm.preload = "auto";
    bgm.loop = true; //habis -> diulang terus sampai game ditutup
    bgm.addEventListener("error", function() {
        console.error("Gagal memuat BGM:", bgm.src);
    });
    //pengaman tambahan: kalau track habis tapi loop tidak jalan otomatis
    //(mis. properti loop ikut ter-reset), mulai lagi dari awal
    bgm.addEventListener("ended", function() {
        if (!muted) {
            bgm.currentTime = 0;
            bgm.play().catch(function() {});
        }
    });
    sounds["bgm"] = bgm;
}

function playSound(name, volume, loop) {
    if (muted) return;
    let s = sounds[name];
    if (!s) return;
    let clone = s.cloneNode(); //clone agar suara sama boleh bunyi bertindih
    clone.volume = (volume != undefined) ? volume : 1.0;
    clone.loop = (loop == true);
    clone.play().catch(function() {
        //browser blokir autoplay sampai ada interaksi user; abaikan saja
    });
}

function startBGM() {
    if (muted) return;
    let s = sounds["bgm"];
    if (!s) return;
    if (!s.paused) return; //sudah berbunyi
    //BGM memakai elemen aslinya (bukan clone) supaya bisa di-stop saat mute
    //trek jazz-nya lembut, jadi volume sedikit dinaikkan agar tetap terdengar
    s.volume = 0.4;
    s.loop = true; //pastikan selalu mengulang selama game terbuka
    let p = s.play();
    if (p !== undefined) {
        p.catch(function() {
            //gagal (autoplay diblok / file masih dimuat) -> dicoba lagi
            //di interaksi user berikutnya lewat listener pointerdown
        });
    }
}

function stopBGM() {
    let s = sounds["bgm"];
    if (!s) return;
    s.pause();
    s.currentTime = 0;
}

var cascadeLevel = 0; //berapa dalam rantai cascade yang sedang berjalan

function playCascadeSounds() {
    if (cascadeLevel <= 0) {
        return;
    }
    //combo 1..12: nada makin naik seiring rantai makin panjang
    let comboNum = Math.min(cascadeLevel, 12);
    playSound("combo_sound" + comboNum, 0.7);

    //voice callout ("Sweet!", "Tasty!", ...) untuk cascade besar
    let callouts = {3: "sweet", 4: "tasty", 5: "delicious"};
    if (cascadeLevel >= 6) {
        playSound("divine", 1.0);
    } else if (callouts[cascadeLevel]) {
        playSound(callouts[cascadeLevel], 1.0);
    }
}


window.onload = function() {
    loadSounds();
    startGame();

    //1/10th of a second
    window.setInterval(function(){
        crushCandy();
        slideCandy();
        generateCandy();
    }, 100);

    //browser hanya mengizinkan audio setelah interaksi user (klik/tekan tombol).
    //listener ini dipasang permanen: BGM dicoba diputar di setiap interaksi
    //selama belum berbunyi (mengatasi play() yang gagal saat percobaan pertama),
    //dan otomatis melanjutkan bila browser memausekan musik (mis. pindah tab)
    document.addEventListener("pointerdown", function() {
        let s = sounds["bgm"];
        if (!muted && s && s.paused) {
            startBGM();
        }
    });

    //tombol mute
    let muteBtn = document.createElement("button");
    muteBtn.id = "muteButton";
    muteBtn.innerText = "🔊";
    muteBtn.addEventListener("click", function() {
        muted = !muted;
        muteBtn.innerText = muted ? "🔇" : "🔊";
        if (muted) {
            stopBGM();
        } else {
            startBGM();
        }
        playSound("button_press", 0.8); //klik tombol
    });
    document.body.appendChild(muteBtn);
}

function randomCandy() {
    return candies[Math.floor(Math.random() * candies.length)]; //0 - 5.99
}

function startGame() {
    for (let r = 0; r < rows; r++) {
        let row = [];
        for (let c = 0; c < columns; c++) {
            // <img id="0-0" src="./images/Red.png">
            let tile = document.createElement("img");
            tile.id = r.toString() + "-" + c.toString();
            tile.src = "./images/" + randomCandy() + ".png";

            //DRAG FUNCTIONALITY
            tile.addEventListener("dragstart", dragStart); //click on a candy, initialize drag process
            tile.addEventListener("dragover", dragOver);  //clicking on candy, moving mouse to drag the candy
            tile.addEventListener("dragenter", dragEnter); //dragging candy onto another candy
            tile.addEventListener("dragleave", dragLeave); //leave candy over another candy
            tile.addEventListener("drop", dragDrop); //dropping a candy over another candy
            tile.addEventListener("dragend", dragEnd); //after drag process completed, we swap candies

            document.getElementById("board").append(tile);
            row.push(tile);
        }
        board.push(row);
    }

    console.log(board);
}

function dragStart() {
    //this refers to tile that was clicked on for dragging
    currTile = this;
}

function dragOver(e) {
    e.preventDefault();
}

function dragEnter(e) {
    e.preventDefault();
}

function dragLeave() {

}

function dragDrop() {
    //this refers to the target tile that was dropped on
    otherTile = this;
}

function dragEnd() {

    if (currTile.src.includes("blank") || otherTile.src.includes("blank")) {
        return;
    }

    let currCoords = currTile.id.split("-"); // id="0-0" -> ["0", "0"]
    let r = parseInt(currCoords[0]);
    let c = parseInt(currCoords[1]);

    let otherCoords = otherTile.id.split("-");
    let r2 = parseInt(otherCoords[0]);
    let c2 = parseInt(otherCoords[1]);

    let moveLeft = c2 == c-1 && r == r2;
    let moveRight = c2 == c+1 && r == r2;

    let moveUp = r2 == r-1 && c == c2;
    let moveDown = r2 == r+1 && c == c2;

    let isAdjacent = moveLeft || moveRight || moveUp || moveDown;

    if (isAdjacent) {
        let currImg = currTile.src;
        let otherImg = otherTile.src;
        currTile.src = otherImg;
        otherTile.src = currImg;

        let validMove = checkValid();
        if (!validMove) {
            let currImg = currTile.src;
            let otherImg = otherTile.src;
            currTile.src = otherImg;
            otherTile.src = currImg;
            playSound("negative_switch_sound1", 0.8); //nada "ditolak" untuk langkah tidak valid
        } else {
            playSound("switch_sound1", 0.8); //whoosh senang untuk swap valid
        }
    }
}

function crushCandy() {
    //crushFive();
    //crushFour();
    cascadeLevel = 0;
    crushThree();

    //cascade selesai -> bunyikan combo + callout sesuai kedalaman rantai
    playCascadeSounds();

    document.getElementById("score").innerText = score;

}

function crushThree() {
    //check rows
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns-2; c++) {
            let candy1 = board[r][c];
            let candy2 = board[r][c+1];
            let candy3 = board[r][c+2];
            if (candy1.src == candy2.src && candy2.src == candy3.src && !candy1.src.includes("blank")) {
                candy1.src = "./images/blank.png";
                candy2.src = "./images/blank.png";
                candy3.src = "./images/blank.png";
                score += 30;
                cascadeLevel += 1; //tiap match bertambah, combo makin dalam
            }
        }
    }

    //check columns
    for (let c = 0; c < columns; c++) {
        for (let r = 0; r < rows-2; r++) {
            let candy1 = board[r][c];
            let candy2 = board[r+1][c];
            let candy3 = board[r+2][c];
            if (candy1.src == candy2.src && candy2.src == candy3.src && !candy1.src.includes("blank")) {
                candy1.src = "./images/blank.png";
                candy2.src = "./images/blank.png";
                candy3.src = "./images/blank.png";
                score += 30;
                cascadeLevel += 1; //tiap match bertambah, combo makin dalam
            }
        }
    }
}

function checkValid() {
    //check rows
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns-2; c++) {
            let candy1 = board[r][c];
            let candy2 = board[r][c+1];
            let candy3 = board[r][c+2];
            if (candy1.src == candy2.src && candy2.src == candy3.src && !candy1.src.includes("blank")) {
                return true;
            }
        }
    }

    //check columns
    for (let c = 0; c < columns; c++) {
        for (let r = 0; r < rows-2; r++) {
            let candy1 = board[r][c];
            let candy2 = board[r+1][c];
            let candy3 = board[r+2][c];
            if (candy1.src == candy2.src && candy2.src == candy3.src && !candy1.src.includes("blank")) {
                return true;
            }
        }
    }

    return false;
}


function slideCandy() {
    for (let c = 0; c < columns; c++) {
        let ind = rows - 1;
        for (let r = columns-1; r >= 0; r--) {
            if (!board[r][c].src.includes("blank")) {
                board[ind][c].src = board[r][c].src;
                ind -= 1;
            }
        }

        for (let r = ind; r >= 0; r--) {
            board[r][c].src = "./images/blank.png";
        }
    }
}

function generateCandy() {
    for (let c = 0; c < columns;  c++) {
        if (board[0][c].src.includes("blank")) {
            board[0][c].src = "./images/" + randomCandy() + ".png";
        }
    }
}