
       enum Visibility {
        None = 0,
        Countdown = 1 << 0,
        Score = 1 << 1,
        Life = 1 << 2,
        Hud = 1 << 3,
        Multi = 1 << 4,
        UserHeartImage = 1 << 5
    }


     class PlayerState {
        public score: number;
        // undefined: not used
        // null: reached 0 and callback was invoked
        public life: number;
        public lifeZeroHandler: () => void;

        constructor() { }
    }

    class InfoState {
        public playerStates: PlayerState[];
        public visibilityFlag: number;

        public gameEnd: number;
        public heartImage: Image;
        public multiplierImage: Image;
        public bgColor: number;
        public borderColor: number;
        public fontColor: number;
        public countdownExpired: boolean;
        public countdownEndHandler: () => void;

        constructor() {
            this.visibilityFlag = Visibility.Hud;
            this.playerStates = [];
            this.heartImage = defaultHeartImage();
            this.multiplierImage = img`
                1 . . . 1
                . 1 . 1 .
                . . 1 . .
                . 1 . 1 .
                1 . . . 1
            `;
            this.bgColor = screen.isMono ? 0 : 1;
            this.borderColor = screen.isMono ? 1 : 3;
            this.fontColor = screen.isMono ? 1 : 3;
            this.countdownExpired = undefined;
            this.countdownEndHandler = undefined;
            this.gameEnd = undefined;
            this.playerStates = [];
        }
    }

    let infoState: InfoState = undefined;

function drawTimer(millis: number) {
        if (millis < 0) millis = 0;
        millis |= 0;

        const font = image.font8;
        const smallFont = image.font5;
        const seconds = Math.idiv(millis, 1000);
        const width = font.charWidth * 5 - 2;
        let left = (screen.width >> 1) - (width >> 1) + 1;
        let color1 = infoState.fontColor;
        let color2 = infoState.bgColor;
        if (seconds < 10 && (seconds & 1) && !screen.isMono) {
            const temp = color1;
            color1 = color2;
            color2 = temp;
        }

        screen.fillRect(left - 3, 0, width + 6, font.charHeight + 3, infoState.borderColor)
        screen.fillRect(left - 2, 0, width + 4, font.charHeight + 2, color2)


        if (seconds < 60) {
            const top = 1;
            const remainder = Math.idiv(millis % 1000, 10);

            screen.print(formatDecimal(seconds) + ".", left, top, color1, font)
            const decimalLeft = left + 3 * font.charWidth;
            screen.print(formatDecimal(remainder), decimalLeft, top + 2, color1, smallFont)
        }
        else {
            const minutes = Math.idiv(seconds, 60);
            const remainder = seconds % 60;
            screen.print(formatDecimal(minutes) + ":" + formatDecimal(remainder), left, 1, color1, font);
        }
    } 

      function formatDecimal(val: number) {
        val |= 0;
        if (val < 10) {
            return "0" + val;
        }
        return val.toString();
    }

      function defaultHeartImage() {
        return screen.isMono ?
            img`
                . 1 1 . 1 1 . .
                1 . . 1 . . 1 .
                1 . . . . . 1 .
                1 . . . . . 1 .
                . 1 . . . 1 . .
                . . 1 . 1 . . .
                . . . 1 . . . .
            `
            :
            img`
                . c 2 2 . 2 2 .
                c 2 2 2 2 2 4 2
                c 2 2 2 2 4 2 2
                c 2 2 2 2 2 2 2
                . c 2 2 2 2 2 .
                . . c 2 2 2 . .
                . . . c 2 . . .
            `;
    }


 let infoStateStack: {
        state: InfoState,
        scene: scene.Scene
    }[];

       let players: PlayerInfo[];

    game.addScenePushHandler(oldScene => {
        if (infoState) {
            if (!infoStateStack) infoStateStack = [];
            infoStateStack.push({
                state: infoState,
                scene: oldScene
            });
            infoState = undefined;
        }
    });

    game.addScenePopHandler(() => {
        const scene = game.currentScene();
        infoState = undefined;
        if (infoStateStack && infoStateStack.length) {
            const nextState = infoStateStack.pop();
            if (nextState.scene == scene) {
                infoState = nextState.state;
            } else {
                infoStateStack.push(nextState);
            }
        }
    });

    
    function initHUD() {
        if (infoState) return;

        infoState = new InfoState();

        scene.createRenderable(
            scene.HUD_Z,
            () => {
                if (!infoState) return;
                control.enablePerfCounter("info")
                // show score, lifes
                if (infoState.visibilityFlag & Visibility.Multi) {
                    const ps = players.filter(p => !!p);
                    // First draw players
                    ps.forEach(p => p.drawPlayer());
                    // Then run life over events
                    ps.forEach(p => p.raiseLifeZero(false));
                } else { // single player
                    // show score
                    const p = player1;
                    if (p.hasScore() && (infoState.visibilityFlag & Visibility.Score)) {
                        p.drawScore();
                    }
                    // show life
                    if (p.hasLife() && (infoState.visibilityFlag & Visibility.Life)) {
                        p.drawLives();
                    }
                    p.raiseLifeZero(true);
                }
                // show countdown in both modes
                if (infoState.gameEnd !== undefined && infoState.visibilityFlag & Visibility.Countdown) {
                    const scene = game.currentScene();
                    const elapsed = infoState.gameEnd - scene.millis();
                    drawTimer(elapsed);
                    let t = elapsed / 1000;
                    if (t <= 0) {
                        t = 0;
                        if (!infoState.countdownExpired) {
                            infoState.countdownExpired = true;
                            infoState.gameEnd = undefined;
                            if (infoState.countdownEndHandler) {
                                infoState.countdownEndHandler();
                            } else {
                                game.over();
                            }
                        }
                    }
                }
            }
        );
    }

     class PlayerInfo {
        protected _player: number;
        public bg: number; // background color
        public border: number; // border color
        public fc: number; // font color
        public showScore?: boolean;
        public showLife?: boolean;
        public visilibity: Visibility;
        public showPlayer?: boolean;
        public x?: number;
        public y?: number;
        public left?: boolean; // if true banner goes from x to the left, else goes rightward
        public up?: boolean; // if true banner goes from y up, else goes downward

        constructor(player: number) {
            this._player = player;
            this.border = 1;
            this.fc = 1;
            this.visilibity = Visibility.None;
            this.showScore = undefined;
            this.showLife = undefined;
            this.showPlayer = undefined;
            this.left = undefined;
            this.up = undefined;
            if (this._player === 1) {
                // Top left, and banner is white on red
                this.bg = screen.isMono ? 0 : 2;
                this.x = 0;
                this.y = 0;
            } else if (player === 2) {
                // Top right, and banner is white on blue
                this.bg = screen.isMono ? 0 : 8;
                this.x = screen.width;
                this.y = 0;
                this.left = true;
            } else if (player === 3) {
                this.bg = screen.isMono ? 0 : 4;
                this.x = 0;
                this.y = screen.height;
                this.up = true;
            } else {
                // bottom left, banner is white on green
                this.bg = screen.isMono ? 0 : 7;
                this.x = screen.width;
                this.y = screen.height;
                this.left = true;
                this.up = true;
            }

            if (!players) players = [];
            players[this._player - 1] = this;
        }

        private init() {
            initHUD();
            // if (this._player > 1) initMultiHUD();
            if (!infoState.playerStates[this._player - 1]) {
                infoState.playerStates[this._player - 1] = new PlayerState();
            }
        }

        getState(): PlayerState {
            this.init();
            return infoState.playerStates[this._player - 1];
        }

        // the id numbera of the player
        id(): number {
            return this._player;
        }

        /**
         * Get the player score
         */
        //% group="Multiplayer"
        //% blockId=piscore2 block="%player score"
        //% help=info/score
        score(): number {
            if (this.showScore === undefined) this.showScore = true;
            if (this.showPlayer === undefined) this.showPlayer = true;

            const state = this.getState();

            if (state.score == null)
                state.score = 0;
            return state.score;
        }

        /**
         * Set the player score
         */
        //% group="Multiplayer"
        //% blockId=pisetscore2 block="set %player score to %value"
        //% value.defl=0
        //% help=info/set-score
        setScore(value: number) {
            const state = this.getState();
            updateFlag(Visibility.Score, true);

            this.score(); // invoked for side effects
            state.score = (value | 0);
        }

        /**
         * Change the score of a player
         * @param value
         */
        //% group="Multiplayer"
        //% blockId=pichangescore2 block="change %player score by %value"
        //% value.defl=1
        //% help=info/change-score-by
        changeScoreBy(value: number): void {
            this.setScore(this.score() + value);
        }

        hasScore() {
            const state = this.getState();
            return state.score !== undefined;
        }

        /**
         * Get the player life
         */
        //% group="Multiplayer"
        //% blockid=piflife2 block="%player life"
        //% help=info/life
        life(): number {
            const state = this.getState();
            if (this.showLife === undefined) this.showLife = true;
            if (this.showPlayer === undefined) this.showPlayer = true;

            if (state.life === undefined) {
                state.life = 3;
            }
            return state.life || 0;
        }

        /**
         * Set the player life
         */
        //% group="Multiplayer"
        //% blockId=pisetlife2 block="set %player life to %value"
        //% value.defl=3
        //% help=info/set-life
        setLife(value: number): void {
            const state = this.getState();
            updateFlag(Visibility.Life, true);

            this.life(); // invoked for side effects
            state.life = (value | 0);
        }

        /**
         * Change the life of a player
         * @param value
         */
        //% group="Multiplayer"
        //% blockId=pichangelife2 block="change %player life by %value"
        //% value.defl=-1
        //% help=info/change-life-by
        changeLifeBy(value: number): void {
            this.setLife(this.life() + value);
        }

        /**
         * Return true if the given player currently has a value set for health,
         * and false otherwise.
         * @param player player to check life of
         */
        //% group="Multiplayer"
        //% blockId=pihaslife block="%player has life"
        //% help=info/has-life
        hasLife(): boolean {
            const state = this.getState();
            return state.life !== undefined && state.life !== null;
        }

        /**
         * Runs code when life reaches zero
         * @param handler
         */
        //% group="Multiplayer"
        //% blockId=playerinfoonlifezero2 block="on %player life zero"
        //% help=info/on-life-zero
        onLifeZero(handler: () => void) {
            const state = this.getState();
            state.lifeZeroHandler = handler;
        }

        raiseLifeZero(gameOver: boolean) {
            const state = this.getState();
            if (state.life !== null && state.life <= 0) {
                state.life = null;
                if (state.lifeZeroHandler) {
                    state.lifeZeroHandler();
                } else if (gameOver) {
                    game.over();
                }
            }
        }

        drawPlayer() {
            const state = this.getState();

            const font = image.font5;
            let score: string;
            let life: string;
            let height = 4;
            let scoreWidth = 0;
            let lifeWidth = 0;
            const offsetX = 1;
            let offsetY = 2;
            let showScore = this.showScore && state.score !== undefined;
            let showLife = this.showLife && state.life !== undefined;

            if (showScore) {
                score = "" + state.score;
                scoreWidth = score.length * font.charWidth + 3;
                height += font.charHeight;
                offsetY += font.charHeight + 1;
            }

            if (showLife) {
                life = "" + (state.life || 0);
                lifeWidth = infoState.heartImage.width + infoState.multiplierImage.width + life.length * font.charWidth + 3;
                height += infoState.heartImage.height;
            }

            const width = Math.max(scoreWidth, lifeWidth);

            // bump size for space between lines
            if (showScore && showLife) height++;

            const x = this.x - (this.left ? width : 0);
            const y = this.y - (this.up ? height : 0);

            // Bordered Box
            if (showScore || showLife) {
                screen.fillRect(x, y, width, height, this.border);
                screen.fillRect(x + 1, y + 1, width - 2, height - 2, this.bg);
            }

            // print score
            if (showScore) {
                const bump = this.left ? width - scoreWidth : 0;
                screen.print(score, x + offsetX + bump + 1, y + 2, this.fc, font);
            }

            // print life
            if (showLife) {
                const xLoc = x + offsetX + (this.left ? width - lifeWidth : 0);

                let mult = infoState.multiplierImage.clone();
                mult.replace(1, this.fc);

                screen.drawTransparentImage(
                    infoState.heartImage,
                    xLoc,
                    y + offsetY
                );
                screen.drawTransparentImage(
                    mult,
                    xLoc + infoState.heartImage.width,
                    y + offsetY + font.charHeight - infoState.multiplierImage.height - 1
                );
                screen.print(
                    life,
                    xLoc + infoState.heartImage.width + infoState.multiplierImage.width + 1,
                    y + offsetY,
                    this.fc,
                    font
                );
            }

            // print player icon
            if (this.showPlayer) {
                const pNum = "" + this._player;

                let iconWidth = pNum.length * font.charWidth + 1;
                const iconHeight = Math.max(height, font.charHeight + 2);
                let iconX = this.left ? (x - iconWidth + 1) : (x + width - 1);
                let iconY = y;

                // adjustments when only player icon shown
                if (!showScore && !showLife) {
                    iconX += this.left ? -1 : 1;
                    if (this.up) iconY -= 3;
                }

                screen.fillRect(
                    iconX,
                    iconY,
                    iconWidth,
                    iconHeight,
                    this.border
                );
                screen.print(
                    pNum,
                    iconX + 1,
                    iconY + (iconHeight >> 1) - (font.charHeight >> 1),
                    this.bg,
                    font
                );
            }
        }

        drawScore() {
            const s = this.score() | 0;

            let font: image.Font;
            let offsetY: number;
            if (s >= 1000000) {
                offsetY = 2;
                font = image.font5;
            }
            else {
                offsetY = 1;
                font = image.font8;
            }

            const num = s.toString();
            const width = num.length * font.charWidth;

            screen.fillRect(
                screen.width - width - 2,
                0,
                screen.width,
                image.font8.charHeight + 3,
                infoState.borderColor
            );
            screen.fillRect(
                screen.width - width - 1,
                0,
                screen.width,
               image.font8.charHeight + 2,
                infoState.bgColor
            );
            screen.print(
                num,
                screen.width - width,
                offsetY,
                infoState.fontColor,
                font
            );
        }

        drawLives() {
            const state = this.getState();
            if (state.life < 0) return;
            const font = image.font8;
            if (state.life <= 4) {
                screen.fillRect(
                    0,
                    0,
                    state.life * (infoState.heartImage.width + 1) + 3,
                    infoState.heartImage.height + 4,
                    infoState.borderColor
                );
                screen.fillRect(
                    0,
                    0,
                    state.life * (infoState.heartImage.width + 1) + 2,
                    infoState.heartImage.height + 3,
                    infoState.bgColor
                );
                for (let i = 0; i < state.life; i++) {
                    screen.drawTransparentImage(
                        infoState.heartImage,
                        1 + i * (infoState.heartImage.width + 1),
                        1
                    );
                }
            }
            else {
                const num = state.life + "";
                const textWidth = num.length * font.charWidth - 1;
                screen.fillRect(
                    0,
                    0,
                    infoState.heartImage.width + infoState.multiplierImage.width + textWidth + 5,
                    infoState.heartImage.height + 4,
                    infoState.borderColor
                );
                screen.fillRect(
                    0,
                    0,
                    infoState.heartImage.width + infoState.multiplierImage.width + textWidth + 4,
                    infoState.heartImage.height + 3,
                    infoState.bgColor
                );
                screen.drawTransparentImage(
                    infoState.heartImage,
                    1,
                    1
                );

                let mult = infoState.multiplierImage.clone();
                mult.replace(1, infoState.fontColor);

                screen.drawTransparentImage(
                    mult,
                    infoState.heartImage.width + 2,
                    font.charHeight - infoState.multiplierImage.height - 1
                );
                screen.print(
                    num,
                    infoState.heartImage.width + 3 + infoState.multiplierImage.width,
                    1,
                    infoState.fontColor,
                    font
                );
            }
        }
    }

      function updateFlag(flag: Visibility, on: boolean) {
        initHUD();
        if (on) infoState.visibilityFlag |= flag;
        else infoState.visibilityFlag = ~(~infoState.visibilityFlag | flag);
    }
    // player1 instance
    const player1 = new PlayerInfo(1);
    player1.changeLifeBy((1))