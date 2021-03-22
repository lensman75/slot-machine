(function () {
    'use strict';
    // https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
    function sqr(x) { return x * x }
    function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
    function distToSegmentSquared(p, v, w) {
        var l2 = dist2(v, w);
        if (l2 == 0) return dist2(p, v);
        var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return dist2(p, {
            x: v.x + t * (w.x - v.x),
            y: v.y + t * (w.y - v.y)
        });
    }
    function distToSegment(p, v, w) { return Math.sqrt(distToSegmentSquared(p, v, w)); }

    // returns points of rectangular
    function rectPoints(r) {
        return [
            cc.p(r.x, r.y),
            cc.p(r.x, r.y + r.height),
            cc.p(r.x + r.width, r.y + r.height),
            cc.p(r.x + r.width, r.y),
        ]
    }

    function rectSegments(r) {
        const p = rectPoints(r);
        return [
            [p[0], p[1]],
            [p[1], p[2]],
            [p[2], p[3]],
            [p[3], p[0]]
        ]
    }

    // rectDistance find distance between two rectangles
    // if rectangles intersect or one contains another then distance equals zero
    function rectDistance(r1, r2) {
        if (cc.rectIntersectsRect(r1, r2) || cc.rectContainsRect(r1, r2) || cc.rectContainsRect(r2, r1)) {
            return 0;
        }

        let minDistance = Infinity;
        for (const p of rectPoints(r1)) {
            for (const [p1, p2] of rectSegments(r2)) {
                minDistance = Math.min(minDistance, distToSegment(p, p1, p2));
            }
        }
        for (const p of rectPoints(r2)) {
            for (const [p1, p2] of rectSegments(r1)) {
                minDistance = Math.min(minDistance, distToSegment(p, p1, p2));
            }
        }

        return minDistance;
    }

    var iconsList = [
        {
            name: "BAR-3",
            spriteName: "icons/CC.png",
        },
        {
            name: "BAR-2",
            spriteName: "icons/DD.png",
        },
        {
            name: "BAR-1",
            spriteName: "icons/EE.png",
        },
        {
            name: "LUCKY-SEVENS",
            spriteName: "icons/WC.png",
        },
        {
            name: "LUCKY-SEVENS-x2",
            spriteName: "icons/WC_X2.png",
        },
        {
            name: "SEVEN-RED",
            spriteName: "icons/AA.png",
        },
        {
            name: "SEVEN-BLUE",
            spriteName: "icons/BB.png",
        }
    ];

    // adapted from https://github.com/Gurigraphics/Cocos2D-JS-Quick-Tutorials/issues/10
    var listener = cc.EventListener.create({
        event: cc.EventListener.TOUCH_ONE_BY_ONE, swallowTouches: true,
        onTouchBegan: function (touch, event) {
            const target = event.getCurrentTarget();

            // targetSize is size of target in target space.
            const targetSize = target.getContentSize();

            // location is position in node space. It is moved and scaled as needed.
            var location = target.convertToNodeSpace(touch.getLocation());

            var targetRectangle = cc.rect(0, 0, targetSize.width, targetSize.height);
            if (cc.rectContainsPoint(targetRectangle, location)) {

                // imitate button click
                const sequenceAction = new cc.Sequence(
                    new cc.MoveBy(0.2, cc.p(0, -10)),
                    new cc.MoveBy(0.2, cc.p(0, 10))
                );

                target.runAction(sequenceAction);

                if (target.onClick) {
                    target.onClick(touch, event);
                }

            }
        }
    });

    var ButtonSprite = cc.Sprite.extend({
        ctor: function () {
            this._super();
            this.initWithFile("img/spin-button.png");
            cc.eventManager.addListener(listener.clone(), this);
        }
    });


    // SpinningCell represents cell - icon (sprite) with a frame
    class SpinningCell {
        sprite = null;
        cell = null;
        topPosition = null;
        bottomPosition = null;
        rotationsPerSecond = null;

        lineWidth = 1;
        lineColor = new cc.Color(195, 195, 195, 255);

        cellFrame = null;

        constructor(sprite, cell, parent, topPosition, bottomPosition, rotationsPerSecond) {
            this.sprite = sprite;
            this.cell = cell;
            this.topPosition = topPosition;
            this.bottomPosition = bottomPosition;
            this.rotationsPerSecond = rotationsPerSecond;

            this.cellFrame = new cc.DrawNode();
            this.cellFrame.setPosition(cell.x, cell.y);
            this.cellFrame.drawRect(
                cc.p(-cell.width / 2, -cell.height / 2),
                cc.p(cell.width / 2, cell.height / 2),
                new cc.Color(0, 0, 0, 0),
                this.lineWidth,
                this.lineColor,
            );
            parent.addChild(this.cellFrame);
        }

        // move icon up. If distance is large enough it spins
        moveUp(distance, duration) {
            if (distance < 0) {
                this.moveDown(-distance, duration);
                return;
            }
            if (duration < 0) {
                throw new Error(`duration should be non negative, got: ${duration}`);
            }

            let dCurrentToTop = 0;
            let nRotations = 0;
            let dBottomToFinal = 0;
            const distanceToTop = this.topPosition.y - this.sprite.getPositionY();
            const maxDistance = this.topPosition.y - this.bottomPosition.y;
            if (distance <= distanceToTop) {
                // distance is too small to spin icon
                dCurrentToTop = distance;
            } else {
                dCurrentToTop = distanceToTop;
                nRotations = Math.floor((distance - distanceToTop) / maxDistance);
                dBottomToFinal = distance - distanceToTop - nRotations * maxDistance;
            }

            const speed = distance / duration;
            // time to move from current position to "top"
            const tCurrentToTop = dCurrentToTop / speed;
            let action = new cc.MoveBy(tCurrentToTop, cc.p(0, dCurrentToTop));
            if (nRotations > 0) {
                // time of one rotation
                const tOneRotation = maxDistance / speed;
                const oneRotationAction = new cc.Sequence(
                    new cc.Place(this.bottomPosition),
                    new cc.MoveTo(tOneRotation, this.topPosition)
                );
                action = new cc.Sequence(
                    action,
                    new cc.Repeat(oneRotationAction, nRotations)
                );
            }
            if (dBottomToFinal > 0) {
                const tBottomToFinal = dBottomToFinal / speed;
                action = new cc.Sequence(
                    action,
                    new cc.MoveBy(tBottomToFinal, cc.p(0, dBottomToFinal))
                );
            }

            this.runAction(action);
        }

        // move icon up. If distance is large enough it spins
        moveDown(distance, duration) {
            if (distance < 0) {
                this.moveUp(-distance, duration);
                return;
            }
            if (duration < 0) {
                throw new Error(`duration should be non negative, got: ${duration}`);
            }

            let dCurrentToBottom = 0;
            let nRotations = 0;
            let dTopToFinal = 0;
            const distanceToBottom = this.sprite.getPositionY() - this.bottomPosition.y;
            const maxDistance = this.topPosition.y - this.bottomPosition.y;
            if (distance <= distanceToBottom) {
                // distance is too small to spin icon
                dCurrentToBottom = distance;
            } else {
                dCurrentToBottom = distanceToBottom;
                nRotations = Math.floor((distance - distanceToBottom) / maxDistance);
                dTopToFinal = distance - distanceToBottom - nRotations * maxDistance;
            }

            const speed = distance / duration;
            // time to move from current position to "bottom"
            const tCurrentToBottom = dCurrentToBottom / speed;
            let action = new cc.MoveBy(tCurrentToBottom, cc.p(0, -dCurrentToBottom));
            if (nRotations > 0) {
                // time of one rotation
                const tOneRotation = maxDistance / speed;
                const oneRotationAction = new cc.Sequence(
                    new cc.Place(this.topPosition),
                    new cc.MoveTo(tOneRotation, this.bottomPosition)
                );
                action = new cc.Sequence(
                    action,
                    new cc.Repeat(oneRotationAction, nRotations)
                );
            }
            if (dTopToFinal > 0) {
                const tTopToFinal = dTopToFinal / speed;
                action = new cc.Sequence(
                    action,
                    new cc.MoveBy(tTopToFinal, cc.p(0, -dTopToFinal))
                );
            }

            this.runAction(action);
        }

        startRotation() {
            const oneRotationTime = 1 / this.rotationsPerSecond;
            const speed = (this.topPosition.y - this.bottomPosition.y) / oneRotationTime;

            this.moveDown(1000 * speed, 1000);
        }

        stopRotation() {
            this.sprite.stopAllActions();
            this.cellFrame.stopAllActions();
        }

        runAction(action) {
            this.sprite.runAction(action.clone());
            this.cellFrame.runAction(action.clone());
        }

        getDistanceToRect(r) {
            const currentPos = this.getPosition();

            const currentRect = new cc.Rect(
                currentPos.x - this.cell.width / 2,
                currentPos.y - this.cell.height / 2,
                this.cell.width,
                this.cell.height
            )
            const d = rectDistance(currentRect, r);
            return d;
        }

        getPosition() {
            return this.cellFrame.getPosition();
        }

    }

    class SpinningColumn {
        xCenter = 0;
        columnWidth = 0;
        rowHeight = 0;
        marginBottom = 0;

        spinningIcons = [];

        getCellCenter(row) {
            return cc.p(
                this.xCenter,
                this.marginBottom + (row + 0.5) * this.rowHeight,
            );
        }

        constructor(xCenter, columnWidth, rowHeight, iconNames, nRows, rotationsPerSecond, parentNode, zIndex) {
            this.xCenter = xCenter;
            this.columnWidth = columnWidth;
            this.rowHeight = rowHeight;
            this.nRows = nRows;

            const sprites = [];
            const cellRects = [];
            for (let iconName of iconNames) {
                const iconDescription = iconsList.find(e => e.name === iconName);
                if (iconDescription === undefined) {
                    throw new Error(`cannot find icon with name ${iconName}`);
                }

                const sprite = new cc.Sprite(cc.spriteFrameCache.getSpriteFrame(iconDescription.spriteName));
                const row = sprites.length;
                const cellCenter = this.getCellCenter(row)
                sprite.setPosition(cellCenter);

                const iconWidth = 0.9 * columnWidth;
                const iconHeight = 0.9 * rowHeight;

                sprite.setScaleX(iconWidth / sprite.getContentSize().width);
                sprite.setScaleY(iconHeight / sprite.getContentSize().height);

                sprite.setName(iconName);

                sprites.push(sprite);
                cellRects.push(new cc.Rect(cellCenter.x, cellCenter.y, columnWidth, rowHeight));
            }

            const topPosition = this.getCellCenter(Math.max(sprites.length - 1, nRows));
            const bottomPosition = this.getCellCenter(-1);
            this.spinningIcons = [];
            for (let i = 0; i < sprites.length; i++) {
                const sprite = sprites[i];
                const cellRect = cellRects[i];
                parentNode.addChild(sprite, zIndex);
                this.spinningIcons.push(new SpinningCell(sprite, cellRect, parentNode, topPosition, bottomPosition, rotationsPerSecond));
            }
        }

        startRotation() {
            this.spinningIcons.forEach(si => si.startRotation());
        }

        stopRotation() {
            this.spinningIcons.forEach(si => si.stopRotation());
        }

        moveUp(distance, duration) {
            this.spinningIcons.forEach(si => si.moveUp(distance, duration));
        }

        runAction(action) {
            this.spinningIcons.forEach(si => si.runAction(action.clone()));
        }

        // stop rotation and then do some small rotation to position cell at
        // specific position 
        stopRotationAtMiddle(rectCenter, duration = 0.2) {
            this.stopRotation();
            const yCenter = rectCenter.y + rectCenter.height / 2;
            const centerCell = this.findNearestCell(rectCenter);
            if (!centerCell) {
                throw new Error(`INTERNAL ERROR: cannot find nearest cell`);
            }
            const yCenterCell = centerCell.getPosition().y;

            this.moveUp(yCenter - yCenterCell, duration);
        }

        // finds sprite which intersects with given rectangle
        // return undefined if none intersects
        findIntersectingSprite(rect) {
            for (const si of this.spinningIcons) {
                const spriteBoundingBox = si.sprite.getBoundingBox();
                if (cc.rectIntersectsRect(spriteBoundingBox, rect)) {
                    return si.sprite;
                }
            }
            return undefined;
        }

        // returns SpinningIcon
        findNearestCell(rect) {
            let cell = undefined;
            let minDistance = Infinity;
            for (const si of this.spinningIcons) {
                const d = si.getDistanceToRect(rect);
                if (d < minDistance) {
                    minDistance = d;
                    cell = si;
                }
            }
            return cell;
        }
    }

    const MainScene = cc.Scene.extend({
        // total game duration in seconds
        gameDuration: 10,

        // time for aligning cells at the end of the game
        aligningTime: 0.2,

        // number rows in the game
        nRows: 3,

        columnsDescription: [
            {
                icons: ["BAR-3", "BAR-2", "BAR-1", "LUCKY-SEVENS", "LUCKY-SEVENS-x2", "SEVEN-RED", "SEVEN-BLUE"],
                rotationsPerSecond: 0.9
            },
            {
                icons: ["BAR-3", "BAR-2", "LUCKY-SEVENS-x2", "SEVEN-RED"],
                rotationsPerSecond: 0.7
            },
            {
                icons: ["BAR-1", "LUCKY-SEVENS", "LUCKY-SEVENS-x2", "SEVEN-RED", "SEVEN-BLUE"],
                rotationsPerSecond: 0.5
            }
        ],

        // height of bottom layer, it contains control button and game result label
        bottomLayerHeight: 100,

        spinnerLayerColor: new cc.Color(255, 255, 255, 255),

        bottomLayerColor: new cc.Color(255, 255, 255, 255),

        gameStatusLabelColor: new cc.Color(0, 0, 0, 255),

        // distance between layer left edge and the frame 
        marginLeft: 0,

        // distance between layer bottom edge and the frame
        marginBottom: 0,

        // color of external "main" frame
        mainFrameColor: new cc.Color(195, 195, 195, 255),

        mainFrameFillColor: new cc.Color(0, 0, 0, 0),

        // width of external "main" frame
        mainFrameWidth: 10,

        columns: [],

        onEnter: function () {
            this._super();
            var size = cc.director.getWinSize();
            console.log("size", size);

            // hide stats window
            cc.director.setDisplayStats(false);

            const spinnerLayer = cc.LayerColor.create(this.spinnerLayerColor, size.width, size.height - this.bottomLayerHeight);
            spinnerLayer.setPosition(0, this.bottomLayerHeight);
            this.addChild(spinnerLayer, 0);

            const bottomLayer = cc.LayerColor.create(this.bottomLayerColor, size.width, this.bottomLayerHeight);
            bottomLayer.setPosition(0, 0);
            this.addChild(bottomLayer, 2);

            const gameStatusLabel = cc.LabelTTF.create("", "Arial", "24", cc.TEXT_ALIGNMENT_CENTER);
            gameStatusLabel.setColor(this.gameStatusLabelColor)
            gameStatusLabel.setPosition(200, 50);
            bottomLayer.addChild(gameStatusLabel, 2);

            let isSpinning = false;

            const startGame = () => {
                if (isSpinning) {
                    return;
                }

                console.log("start spinning");
                gameStatusLabel.setString("");


                for (const column of this.columns) {
                    column.startRotation();
                }

                isSpinning = true;
            };

            const stopGame = () => {
                if (!isSpinning) {
                    return;
                }


                for (const column of this.columns) {
                    column.stopRotationAtMiddle(middleLineRect, this.aligningTime);
                }

                const rez = this.columns.map(c => c.findNearestCell(middleLineRect)?.sprite?.getName());


                const allEqual = arr => arr.every(v => v === arr[0])

                if (allEqual(rez)) {
                    gameStatusLabel.setString("Result: Win");
                } else {
                    gameStatusLabel.setString("Result: Not Win");
                }

                isSpinning = false;
            }

            var spinButtonSprite = new ButtonSprite();
            spinButtonSprite.setPosition(size.width * 0.7, size.height * 0.1);
            spinButtonSprite.setScale(0.6);
            spinButtonSprite.onClick = () => {
                if (!isSpinning) {
                    startGame();
                    spinButtonSprite.setVisible(false);
                    setTimeout(() => {
                        stopGame();
                        spinButtonSprite.setVisible(true);
                    }, 1000 * this.gameDuration - this.aligningTime);
                }
            };
            bottomLayer.addChild(spinButtonSprite, 2);

            cc.spriteFrameCache.addSpriteFrames("img/icons.plist", "img/icons.png");

            const machineFrame = new cc.DrawNode();

            const frameWidth = size.width;
            const frameHeight = size.height - this.bottomLayerHeight;

            machineFrame.drawRect(cc.p(this.marginLeft, this.marginBottom), cc.p(this.marginLeft + frameWidth, this.marginBottom + frameHeight), this.mainFrameFillColor, this.mainFrameWidth, this.mainFrameColor);

            const nColumns = this.columnsDescription.length;

            const columnWidth = frameWidth / nColumns;
            const rowHeight = frameHeight / this.nRows;


            spinnerLayer.addChild(machineFrame);


            const middleLineWidth = 2;
            const middleLineColor = new cc.Color(255, 0, 0, 255);

            const middleLine = new cc.DrawNode();
            middleLine.drawSegment(
                cc.p(this.marginLeft, this.marginBottom + frameHeight / 2),
                cc.p(this.marginLeft + frameWidth, this.marginBottom + frameHeight / 2),
                middleLineWidth,
                middleLineColor,
            );
            spinnerLayer.addChild(middleLine, 5);
            const middleLineRect = new cc.rect(
                this.marginLeft,
                this.marginBottom + frameHeight / 2 - middleLineWidth / 2,
                frameWidth,
                middleLineWidth
            );

            this.columns = [];
            for (let i = 0; i < this.columnsDescription.length; i++) {
                const column = new SpinningColumn(
                    this.marginLeft + (i + 0.5) * columnWidth,
                    columnWidth, rowHeight,
                    this.columnsDescription[i].icons,
                    this.nRows,
                    this.columnsDescription[i].rotationsPerSecond,
                    spinnerLayer, 4
                );
                this.columns.push(column);
            }
        }
    });

    window.onload = function () {
        cc.game.onStart = function () {
            //load resources. All resources should be mentioned here.
            cc.LoaderScene.preload(["./img/mockup.png", "img/icons.png", "img/icons.plist"], function () {
                cc.director.runScene(new MainScene());
            }, this);
        };
        cc.game.run("gameCanvas");
    };
})();