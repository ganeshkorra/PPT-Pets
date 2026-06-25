import { _decorator, Component, UIOpacity, instantiate, Size, Node, Vec3, AudioClip, AudioSource, Color, SpriteFrame, Tween, Graphics, tween, v3, Sprite, Event, director, Layout, UITransform, Label, CCInteger, Button, ProgressBar } from 'cc';
const { ccclass, property } = _decorator;
import { Analytics, analyticsEvents } from "./Analytics";
import { CTAButtonHandler } from './CTAButtonHandler';

@ccclass('GridController')
export class GridController extends Component {

    // --- UI ELEMENTS ---
    @property(Label)
    timerLabel: Label = null!;

    @property(Node)
    selectionMenu: Node = null!;

    @property(Node)
    associatedHint: Node = null!;

    @property(Node)
    hintContainer: Node = null!;

    @property(Node)
    decorationNode: Node = null!;

    @property(Node)
    ctaEndScreen: Node = null!;

    @property(String)
    correctItemName: string = "";

    // --- FEEDBACK & LIVES ---
    @property([Sprite])
    heartSprites: Sprite[] = [];

    @property(SpriteFrame)
    brokenHeartFrame: SpriteFrame = null!;

    @property(Node)
    guideNode: Node = null!;

    @property(Node)
    handNode: Node = null!;

    @property(SpriteFrame)
    idleHandSprite: SpriteFrame = null!;

    @property(SpriteFrame)
    clickHandSprite: SpriteFrame = null!;

    @property({ type: CCInteger })
    totalMatchesNeeded: number = 8;

    @property(Node)
    successRotationEffect: Node = null!;

    @property([Node])
    hiddenCluesToUnlock: Node[] = [];

    @property(SpriteFrame)
    bonusClueGraphic: SpriteFrame = null!;

    @property(Node)
    pinNode: Node = null!;

    @property([Node])
    extraHintsToClear: Node[] = [];

    @property([Node])
    extraRightNodes: Node[] = []; // NEW PROPERTY: Link right ticks for the extra hints here

    // --- STATIC STATE (GLOBAL TO ALL BOXES) ---
    private static currentMistakes: number = 0;
    private static activeBox: GridController | null = null;
    private static timerMaster: GridController | null = null;
    private static matchesMade: number = 0;

    private static globalTimerLabel: Label | null = null;
    private static remainingTime: number = 60;
    private static isTimerStarted: boolean = false;
    private static isGameOver: boolean = false;

    private static idleTimer: number = 0;
    private static isHandShowing: boolean = false;
    private static initialHandScale: Vec3 = v3(1, 1, 1);
    private static hasShownFirstTapHand: boolean = false;
    private readonly IDLE_THRESHOLD: number = 10;

    private static allBoxes: GridController[] = [];
    private static globalHandNode: Node | null = null;
    private static globalHandIdle: SpriteFrame | null = null;
    private static globalHandClick: SpriteFrame | null = null;
    private static hintOriginalScales: Map<Node, Vec3> = new Map();

    @property(AudioClip) bgmClip: AudioClip = null!;
    @property(AudioClip) clickBoxClip: AudioClip = null!;
    @property(AudioClip) winMatchClip: AudioClip = null!;
    @property(AudioClip) wrongMatchClip: AudioClip = null!;

    private static bgmSource: AudioSource = null!;
    private static fxSource: AudioSource = null!;

    private static globalCtaEndScreen: Node | null = null;
    private isSolved: boolean = false;

    @property(AudioClip)
    hintVoiceClip: AudioClip = null!;

    @property(Node)
    rightNode: Node = null!;

 @property(ProgressBar)
    selectionTimerBar: ProgressBar = null!;

    // @property(CCInteger)
    // menuTimerDuration: number = 3; // Time in seconds for the bar to empty
    // // Inside GridController class
@property(ProgressBar)
highlightBar: ProgressBar = null!; // Link this to the 'Highlight Text' node in each Box's Inspector


@property(Boolean)
    enableTapTriggerCTA: boolean = false; // Toggle this ON in Inspector to enable

    @property(CCInteger)
    maxTapsBeforeCTA: number = 5; // Set the number of taps here (2, 3, 4, etc)

    private static globalUserTapCount: number = 0; // The actual counter



    private static isChallengeStarted: boolean = false;
    private static hasPassed25: boolean = false;
    private static hasPassed50: boolean = false;
    private static hasPassed75: boolean = false;


    private originalGridScale: Vec3 = v3(1, 1, 1);
    private originalHintScale: Vec3 = v3(0.565, 0.565, 0.565);
    private hintDesignSize: { width: number, height: number } = { width: 0, height: 0 };
    private originalMenuItemScale: Vec3 = v3(1, 1, 1);
    private originalSelectionMenuScale: Vec3 = v3(1, 1, 1);
    private designScale: Vec3 = v3(1, 1, 1);
    private designSize: { width: number, height: number } = { width: 0, height: 0 };
    private selectedFrameNode: Node | null = null;
    private decorationDesignScale: Vec3 = v3(1, 1, 1);
    private decorationDesignSize: { width: number, height: number } = { width: 0, height: 0 };
    private decorOriginalScale: Vec3 = v3(1, 1, 1);
    private decorOriginalSize: { width: number, height: number } = { width: 0, height: 0 };
    private menuItemScales: Map<string, Vec3> = new Map();
    private menuDesignScale: Vec3 = v3(1, 1, 1);
    private targetScale: Vec3 = v3(1, 1, 1);
    private targetSize: { width: number, height: number } = { width: 0, height: 0 };


    private checkTapProgress() {
        if (!this.enableTapTriggerCTA || GridController.isGameOver) return;

        GridController.globalUserTapCount++;
        console.log(`[USER TAPS] ${GridController.globalUserTapCount} / ${this.maxTapsBeforeCTA}`);

        if (GridController.globalUserTapCount >= this.maxTapsBeforeCTA) {
            console.warn("[CTA TRIGGER] Tap limit reached. Sending user to End Screen.");
            this.handleGameOver("TAP_LIMIT");
        }
    }



    start() {
        // Fire LOADED → DISPLAYED sequence when game first loads (only once)
        if (GridController.allBoxes.length === 0) {
            if (Analytics.instance) {
                // 1. Fire LOADED first to signal assets are ready
                Analytics.instance.dispatchEvent(analyticsEvents.LOADED);
                console.log("[Analytics] LOADED event fired");
                
                // 2. Fire DISPLAYED after LOADED
                Analytics.instance.dispatchEvent(analyticsEvents.DISPLAYED);
                console.log("[Analytics] DISPLAYED event fired on game load");
            }
        }

        this.originalGridScale = this.node.scale.clone();
        this.designScale = this.node.scale.clone();
        const uiTrans = this.node.getComponent(UITransform);
        if (uiTrans) {
            this.designSize = { width: uiTrans.contentSize.width, height: uiTrans.contentSize.height };
        }
        this.targetScale = this.node.scale.clone();
        if (uiTrans) {
            this.targetSize = { width: uiTrans.contentSize.width, height: uiTrans.contentSize.height };
        }
        if (this.associatedHint) {
            this.originalHintScale = this.associatedHint.scale.clone();
            const hintTrans = this.associatedHint.getComponent(UITransform);
            if (hintTrans) {
                this.hintDesignSize = { width: hintTrans.contentSize.width, height: hintTrans.contentSize.height };
            }
        }
        this.cacheHintOriginalScales();
        if (this.selectionMenu) {
            this.menuDesignScale = this.selectionMenu.scale.clone();
            this.originalSelectionMenuScale = this.selectionMenu.scale.clone();
            this.selectionMenu.children.forEach(child => {
                this.menuItemScales.set(child.name, child.scale.clone());
            });
            if (this.selectionMenu.children.length > 0) {
                this.originalMenuItemScale = this.selectionMenu.children[0].scale.clone();
            }
            this.selectionMenu.active = false;
        }

        if (this.decorationNode) {
            this.decorOriginalScale = this.decorationNode.scale.clone();
            const uiTrans = this.decorationNode.getComponent(UITransform);
            if (uiTrans) {
                this.decorOriginalSize = { width: uiTrans.contentSize.width, height: uiTrans.contentSize.height };
            }
            this.decorationNode.active = false;
        }

        GridController.allBoxes.push(this);
        if (GridController.allBoxes.length === 1) {
            this.scheduleOnce(() => this.runEntrySequence(), 0.5);
        }
        if (GridController.timerMaster === null) GridController.timerMaster = this;
        if (this.ctaEndScreen) {
            GridController.globalCtaEndScreen = this.ctaEndScreen;
            this.ctaEndScreen.active = false;
        }
        if (!GridController.bgmSource) {
            GridController.bgmSource = this.node.addComponent(AudioSource);
        }
        if (!GridController.fxSource) {
            GridController.fxSource = this.node.addComponent(AudioSource);
        }
        if (this.handNode) {
            GridController.globalHandNode = this.handNode;
            GridController.initialHandScale = this.handNode.scale.clone();
            GridController.globalHandNode.active = false;
        }
        if (this.idleHandSprite) GridController.globalHandIdle = this.idleHandSprite;
        if (this.clickHandSprite) GridController.globalHandClick = this.clickHandSprite;
        if (this.timerLabel) {
            GridController.globalTimerLabel = this.timerLabel;
            GridController.globalTimerLabel.string = `Time: 60`;
        }
        if (this.selectionMenu) this.selectionMenu.active = false;
        if (this.decorationNode) this.decorationNode.active = false;
        if (this.handNode) {
            GridController.initialHandScale = this.handNode.scale.clone();
            this.handNode.active = false;
        }
        if (this.guideNode) {
            this.guideNode.active = false;
            this.guideNode.setScale(v3(0, 0, 0));
        }
    }

   update(dt: number) {
    if (GridController.timerMaster !== this) return;
    if (GridController.isTimerStarted && !GridController.isGameOver) {
        GridController.remainingTime -= dt;
        if (GridController.globalTimerLabel) {
            const displayTime = Math.max(0, Math.ceil(GridController.remainingTime));
            GridController.globalTimerLabel.string = `Time: ${displayTime}`;
        }
        if (GridController.remainingTime <= 0) {
            this.handleGameOver("TIME OUT");
        }
        GridController.idleTimer += dt;

        if (GridController.idleTimer >= this.IDLE_THRESHOLD && !GridController.isHandShowing) {
            if (GridController.activeBox && GridController.activeBox.selectionMenu.active) {
                GridController.activeBox.showHandOnCorrectMenuItem();
                GridController.activeBox.applyPulse(GridController.activeBox.node, true);
            }
            else {
                // --- SMART TARGET SEARCH ---
                const targetBox = GridController.allBoxes.find(box => {
                    if (box.isSolved) return false; // Skip solved boxes

                    // Logic: A box is valid if:
                    // 1. It has an active hint currently visible
                    const hasActiveHint = (box.associatedHint && box.associatedHint.active);
                    
                    // 2. OR it has NO hint but HAS items in the reveal list (Progress blocks)
                    const hasHiddenClues = (box.hiddenCluesToUnlock.length > 0 && !box.associatedHint);
                    
                    return hasActiveHint || hasHiddenClues;
                });

                if (targetBox) {
                    targetBox.showIdleHint();
                } else {
                    GridController.idleTimer = 0;
                }
            }
        }
    }
}

   private runEntrySequence() {
    // Only animate boxes that are NOT already solved (useful if restarting)
    const boxesToBlink = GridController.allBoxes
        .filter(box => !box.isSolved)
        .sort((a, b) => {
            // Sort by node name (assuming 1, 2, 3...)
            const aNum = parseInt(a.node.name) || 0;
            const bNum = parseInt(b.node.name) || 0;
            return aNum - bNum;
        });

    const blinkInterval = 0; // Fast, sequential ripple

    boxesToBlink.forEach((box, index) => {
        this.scheduleOnce(() => {
            if (box.node?.isValid) {
                // box.showEntryBlink(box.node);
            }
        }, index * blinkInterval);
    });

    // Show tutorial items (Hand/Dotted frame) AFTER all blinks are finished
    const totalTime = (boxesToBlink.length * blinkInterval) + 0;
    this.scheduleOnce(() => {
        const firstBox = GridController.allBoxes.find(b => b.node.name === "1") || boxesToBlink[0];
        if (firstBox && !firstBox.isSolved) {
            firstBox.showInitialTutorial(); 
        }
    }, totalTime);
}
    private showInitialTutorial() {
        if (GridController.isGameOver || GridController.isTimerStarted) return;

        const guideOwner = GridController.allBoxes.find(box => box.guideNode) || this;
        const handTarget = GridController.allBoxes.find(box =>
            !box.isSolved &&
            box.associatedHint &&
            box.associatedHint.active
        ) || this;

        guideOwner.showGuideLabel();
        // handTarget.showSelectedFrame();

        if (handTarget.associatedHint && handTarget.associatedHint.active) {
            handTarget.showIdleHint();
        }
    }

    private showGuideLabel() {
        if (!this.guideNode) return;

        Tween.stopAllByTarget(this.guideNode);
        this.guideNode.active = true;
        this.guideNode.setScale(v3(0, 0, 0));
        tween(this.guideNode).to(0.5, { scale: v3(1, 1, 1) }, { easing: 'backOut' })
            .call(() => {
                tween(this.guideNode).to(0.8, { scale: v3(1.1, 1.1, 1) }, { easing: 'sineInOut' })
                    .to(0.8, { scale: v3(1, 1, 1) }, { easing: 'sineInOut' })
                    .union().repeatForever().start();
            }).start();
    }

//   private showEntryBlink(targetNode: Node) {
//     const sprite = targetNode.getComponent(Sprite);
//     if (!sprite) return;

//     // 1. Create a temporary flash overlay for the blink
//     // This allows us to have rounded corners even if the box is square
//     let flash = targetNode.getChildByName("BlinkFlash");
//     if (!flash) {
//         flash = new Node("BlinkFlash");
//         targetNode.addChild(flash);
//         const ut = flash.addComponent(UITransform);
//         ut.setContentSize(targetNode.getComponent(UITransform)!.contentSize);
//         flash.addComponent(Graphics);
//         flash.addComponent(UIOpacity);
//     }
    
//     const g = flash.getComponent(Graphics)!;
//     const ut = flash.getComponent(UITransform)!;
//     const opacity = flash.getComponent(UIOpacity)!;
    
//     // --- DRAW CURVED BLINK BACKGROUND ---
//     const flashColor = new Color().fromHEX('#FFF59D'); // Light Beige/Yellow
//     g.clear();
//     g.fillColor = flashColor;
//     // (x, y, width, height, cornerRadius)
//     g.roundRect(-ut.width/2, -ut.height/2, ut.width, ut.height, 20); 
//     g.fill();

//     flash.active = true;
//     opacity.opacity = 0;
    
//     // Set the base cell to the "OFF" state (Gray) immediately
//     sprite.color = Color.WHITE;

//     // --- SEQUENTIAL ANIMATION ---
//     Tween.stopAllByTarget(targetNode);
//     Tween.stopAllByTarget(opacity);

//     tween(targetNode)
//         .to(0.15, { scale: v3(this.originalGridScale.x * 1, this.originalGridScale.y * 1, 1) }, { easing: 'sineOut' })
//         .to(0.15, { scale: this.originalGridScale }, { easing: 'sineIn' })
//         .start();

//     tween(opacity)
//         .to(0.1, { opacity: 255 }) // Fade In
//         .delay(0.01)
//         .to(0.01, { opacity: 0 })   // Fade Out
//         .call(() => {
//             flash.active = false; 
//             // Stay Gray!
//             sprite.color = Color.WHITE; 
//         })
//         .start();
// }
// Ensure this is PUBLIC so the other boxes can call it during a loop
    public hideSelectedFrame() {
        if (this.selectedFrameNode && this.selectedFrameNode.isValid) {
            this.selectedFrameNode.active = false;
        }
    }

    // Helper for your new corner logic
    private drawCornerDash(graphics: Graphics, x: number, y: number, angle: number) {
        // Keeps the rounded corner looking smooth
        graphics.circle(x, y, 2.0); 
    }

    // The updated frame logic (make sure it's public if called from external sequences)
public showSelectedFrame() {
    GridController.allBoxes.forEach(box => box.hideSelectedFrame());

    const uiTrans = this.node.getComponent(UITransform);
    if (!uiTrans) return;

    if (!this.selectedFrameNode || !this.selectedFrameNode.isValid) {
        this.selectedFrameNode = new Node("SelectedDottedButton");
        this.node.addChild(this.selectedFrameNode);
        this.selectedFrameNode.addComponent(Graphics);
    }

    const graphics = this.selectedFrameNode.getComponent(Graphics)!;
    
    // --- EXACT PARAMETERS FOR THE REFERENCE LOOK ---
    const width = uiTrans.contentSize.width - 6; 
    const height = uiTrans.contentSize.height - 6;
    const halfW = width / 2;
    const halfH = height / 2;
    
    const borderRadius = 25;       // Rounded corner radius
    const dashLength = 9;         // Dash length
    const gap = 7;                 // Dash gap
    const thickness = 4.2;         // Stitch thickness
    const inset = 4.5;             // Margin from edge
    // -----------------------------------------------

    this.selectedFrameNode.active = true;
    this.selectedFrameNode.setPosition(0, 0, 0);
    this.selectedFrameNode.setScale(1.05, 1.05, 1.05);
    this.selectedFrameNode.setSiblingIndex(this.node.children.length - 1);

    graphics.clear();

    // 1. DRAW BEIGE BACKGROUND (The Fill)
    graphics.fillColor = new Color().fromHEX('#FFF59D');
    // ().fromHEX('#FFF59D')
    graphics.roundRect(-halfW, -halfH, width, height, borderRadius);
    graphics.fill();

    // 2. SETUP BROWN STITCHES (The Dashes)
    graphics.strokeColor = new Color(179, 126, 64, 255);
    
    graphics.lineWidth = thickness;
    graphics.lineCap = Graphics.LineCap.ROUND;
    graphics.lineJoin = Graphics.LineJoin.ROUND;

    const r = borderRadius - inset;
    const innerW = halfW - borderRadius;
    const innerH = halfH - borderRadius;

    // TOP EDGE
    this.manualStitchLine(graphics, -innerW, halfH - inset, innerW, halfH - inset, dashLength, gap);
    // BOTTOM EDGE
    this.manualStitchLine(graphics, -innerW, -halfH + inset, innerW, -halfH + inset, dashLength, gap);
    // LEFT EDGE
    this.manualStitchLine(graphics, -halfW + inset, -innerH, -halfW + inset, innerH, dashLength, gap);
    // RIGHT EDGE
    this.manualStitchLine(graphics, halfW - inset, -innerH, halfW - inset, innerH, dashLength, gap);

    // --- CORNERS (Calculated manually to prevent the circle glitch) ---
    // Top Right
    this.manualStitchArc(graphics, innerW, innerH, r, 0, 90, dashLength, gap);
    // Top Left
    this.manualStitchArc(graphics, -innerW, innerH, r, 90, 180, dashLength, gap);
    // Bottom Left
    this.manualStitchArc(graphics, -innerW, -innerH, r, 180, 270, dashLength, gap);
    // Bottom Right
    this.manualStitchArc(graphics, innerW, -innerH, r, 270, 360, dashLength, gap);
}

private spawnClickRipple(worldPos: Vec3) {
    const rippleNode = new Node("ClickRipple");
    const canvas = director.getScene()?.getChildByPath("Canvas");
    if (!canvas) return;

    canvas.addChild(rippleNode);
    rippleNode.setWorldPosition(worldPos);

    // Spread the 5 rays evenly around the center (Vertical Up)
    const startAngle = -80; // Tilted left
    const angleStep = 30;   // 30 degrees distance between each ray

    for (let i = 0; i < 5; i++) {
        const ray = new Node("Ray");
        rippleNode.addChild(ray);
        
        const g = ray.addComponent(Graphics);
        const color = new Color().fromHEX('#FFD600'); // Bright Yellow
        g.fillColor = color;
        
        // Draw the "Sausage" dash
        // Increased thickness and length slightly to match image 2
        g.roundRect(-2.5, 0, 5, 16, 2.5);
        g.fill();

        // 1. Calculate the Angle: Result will be -60, -30, 0, 30, 60
        const angle = startAngle + (i * angleStep);
        const rad = angle * Math.PI / 180;

        // 2. Rotate the Dash Node to face outward
        // We use negative angle because Cocos rotations are counter-clockwise
        ray.angle = -angle;
        
        // 3. Initial state
        const op = ray.addComponent(UIOpacity);
        op.opacity = 0;
        ray.setScale(v3(0, 0, 1));

        // 4. Animation: Burst outwards directly in the direction of the angle
        const burstDistance = 25; // Distance from center

        tween(ray)
            .parallel(
                tween().to(0.3, { scale: v3(1, 1, 1) }, { easing: 'backOut' }),
                tween().to(0.4, { 
                    position: v3(
                        Math.sin(rad) * burstDistance, 
                        Math.cos(rad) * burstDistance, 
                        0
                    ) 
                }, { easing: 'quartOut' }),
                tween(op).to(0.1, { opacity: 255 }).delay(0.2).to(0.2, { opacity: 0 })
            )
            .call(() => {
                if (i === 4) rippleNode.destroy();
            })
            .start();
    }
}

private manualStitchLine(g: Graphics, x1: number, y1: number, x2: number, y2: number, len: number, gap: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const totalDist = Math.sqrt(dx * dx + dy * dy);
    let progress = 0;

    while (progress < totalDist) {
        const startT = progress / totalDist;
        const endT = Math.min(progress + len, totalDist) / totalDist;
        g.moveTo(x1 + dx * startT, y1 + dy * startT);
        g.lineTo(x1 + dx * endT, y1 + dy * endT);
        g.stroke();
        progress += (len + gap);
    }
}

private manualStitchArc(g: Graphics, cx: number, cy: number, r: number, startDeg: number, endDeg: number, len: number, gap: number) {
    const totalRad = (Math.PI / 180) * (endDeg - startDeg);
    const circumference = Math.abs(totalRad) * r;
    const angleForStep = (len + gap) / r;
    const angleForDash = len / r;

    let currentAngle = (Math.PI / 180) * startDeg;
    const finalAngle = (Math.PI / 180) * endDeg;

    while (currentAngle < finalAngle) {
        let segmentEnd = currentAngle + angleForDash;
        if (segmentEnd > finalAngle) segmentEnd = finalAngle;

        // Approximating the curve with 3 tiny straight lines per dash
        // This is perfectly curved to the eye but safe from engine glitches
        const steps = 3;
        g.moveTo(cx + Math.cos(currentAngle) * r, cy + Math.sin(currentAngle) * r);
        
        for (let i = 1; i <= steps; i++) {
            const subAngle = currentAngle + (segmentEnd - currentAngle) * (i / steps);
            g.lineTo(cx + Math.cos(subAngle) * r, cy + Math.sin(subAngle) * r);
        }
        g.stroke();
        currentAngle += angleForStep;
    }
}

// private drawActualDashedLine(g: Graphics, x1: number, y1: number, x2: number, y2: number, dashLen: number, gap: number) {
//     const dx = x2 - x1;
//     const dy = y2 - y1;
//     const distance = Math.sqrt(dx * dx + dy * dy);
//     let current = 0;

//     while (current < distance) {
//         const startT = current / distance;
//         const endT = Math.min(current + dashLen, distance) / distance;
        
//         g.moveTo(x1 + startT * dx, y1 + startT * dy);
//         g.lineTo(x1 + endT * dx, y1 + endT * dy);
//         g.stroke(); // Draw this segment
        
//         current += (dashLen + gap);
//     }
// }

// private drawActualDashedArc(g: Graphics, cx: number, cy: number, r: number, startDeg: number, endDeg: number, dashLen: number, gap: number) {
//     const startRad = startDeg * (Math.PI / 180);
//     const endRad = endDeg * (Math.PI / 180);
    
//     // The "Angle step" is determined by dash length relative to the circle size (Arc Length / Radius)
//     const angleForDash = dashLen / r; 
//     const angleForGap = gap / r;
//     const totalStep = angleForDash + angleForGap;

//     let currentAngle = startRad;

//     // Correct for bottom-right corner going past 360 to ensure the loop finishes
//     while (currentAngle < endRad) {
//         let segmentEnd = currentAngle + angleForDash;
        
//         // Ensure we don't draw past the end of the corner
//         if (segmentEnd > endRad) segmentEnd = endRad;

//         // moveTo is critical: move the pen to the start of the curved segment
//         g.moveTo(cx + Math.cos(currentAngle) * r, cy + Math.sin(currentAngle) * r);
//         // arc actually draws a BENT line along the path
//         g.arc(cx, cy, r, currentAngle, segmentEnd, false);
//         g.stroke();
        
//         currentAngle += totalStep;
//     }
// }
    private applyPulse(targetNode: Node, isOn: boolean) {
        Tween.stopAllByTarget(targetNode);
        const isHint = targetNode === this.associatedHint || targetNode.parent?.name === "Hints";
        const baseScale = isHint ? this.originalHintScale : this.originalGridScale;
        const sprite = targetNode.getComponent(Sprite);
        if (isOn) {
            const targetScale = v3(baseScale.x * 1.02, baseScale.y * 1.02, 1);
            const highlightColor = new Color().fromHEX('#FFF59D');
            tween(targetNode).parallel(
                tween().to(1.0, { scale: targetScale }, { easing: 'sineInOut' }).to(1.0, { scale: baseScale }, { easing: 'sineInOut' }),
                sprite ? tween(sprite).to(1.0, { color: highlightColor }, { easing: 'sineInOut' }).to(1.0, { color: Color.WHITE }, { easing: 'sineInOut' }) : tween()
            ).union().repeatForever().start();
        } else {
            targetNode.setScale(baseScale);
            if (sprite) sprite.color = Color.WHITE;
        }
    }

    onGridCellClicked(event: Event) {
        if (GridController.isGameOver || this.isSolved) return;
          // --- NEW: Track User Taps ---
        this.checkTapProgress();

        if (!GridController.isChallengeStarted) {
            GridController.isChallengeStarted = true;
            Analytics.instance?.dispatchEvent(analyticsEvents.CHALLENGE_STARTED);
        }
        if (GridController.isGameOver) return;
        if (!GridController.isTimerStarted) {
            GridController.isTimerStarted = true;
            if (this.bgmClip && GridController.bgmSource) {
                GridController.bgmSource.clip = this.bgmClip;
                GridController.bgmSource.loop = true;
                GridController.bgmSource.volume = 0.5;
                GridController.bgmSource.play();
            }
        }
        if (this.clickBoxClip && GridController.fxSource) {
            GridController.fxSource.playOneShot(this.clickBoxClip, 1);
        }
        if (this.guideNode) {
            Tween.stopAllByTarget(this.guideNode);
            this.guideNode.active = false;
        }
        if (!GridController.isTimerStarted) GridController.isTimerStarted = true;
        this.hideTutorialElements("Box Clicked");
        // Do not play hint voice on every grid tap. Hint voice is handled after clue reveal/reposition.
        // this.syncHintHighlight();
        if (GridController.activeBox && GridController.activeBox !== this) {
            GridController.activeBox.closeSelectionMenu();
        }
        if (this.selectionMenu.active) return;
        // this.showSelectedFrame();
        this.selectionMenu.active = true;
        GridController.activeBox = this;
        
          // --- FIX 1: TOP LAYER FORCE ---
    // Get the Canvas so we can move the menu there if it isn't already
    const canvas = director.getScene()?.getChildByPath("Canvas");
    if (canvas) {
        this.selectionMenu.parent = canvas; // Moves it out of any box to the Root
        this.selectionMenu.setSiblingIndex(canvas.children.length - 1); // Absolute bottom of list = TOP of view
    }

    GridController.activeBox = this; 
    
    // --- FIX 2: COORDINATE CALCULATIONS ---
    // Since it's on the Canvas now, we set the World Position
    // We target slightly below the box clicked
    const boxWorldPos = this.node.worldPosition;
        this.selectionMenu.setWorldPosition(v3(this.node.worldPosition.x, this.node.worldPosition.y - 80, 0));
        this.selectionMenu.setScale(v3(0, 0, 0));
        tween(this.selectionMenu).to(0.2, { scale: this.originalSelectionMenuScale }, { easing: 'backOut' }).call(() => {
            if (!GridController.hasShownFirstTapHand) {
                this.showHandOnCorrectMenuItem();
                GridController.hasShownFirstTapHand = true;
            }
            //   this.startMenuTimer();
        }).start();
    }
    private syncHintHighlight() {
    // 1. Safety: Do we have a hint and a voice clip?
    if (!this.associatedHint || !this.hintVoiceClip) return;

    // 2. Reset all bars across all grid cells
    GridController.allBoxes.forEach(box => {
        if (box.highlightBar) {
            Tween.stopAllByTarget(box.highlightBar);
            box.highlightBar.progress = 0;
        }
    });

    // 3. Play the Audio Clip
    if (GridController.fxSource) {
        GridController.fxSource.stop();
        GridController.fxSource.clip = this.hintVoiceClip;
        GridController.fxSource.play();

        // --- THE FIX ---
        // We cast this.hintVoiceClip to 'any' to bypass the TypeScript error.
        // Also adding a fallback ( || 2.0) in case the duration isn't loaded yet.
        const audioClip = this.hintVoiceClip as any;
        const clipDuration = audioClip.duration || 2.0; 

        if (this.highlightBar) {
            this.highlightBar.progress = 0;
            
            tween(this.highlightBar)
                .to(clipDuration, { progress: 1 })
                .start();
        }
    }
}
// private startMenuTimer() {
//     if (!this.selectionTimerBar) return;

//     // Reset bar to full
//     Tween.stopAllByTarget(this.selectionTimerBar);
//     this.selectionTimerBar.progress = 2;

//     // Animate to empty
//     tween(this.selectionTimerBar)
//         // .to(this.menuTimerDuration, { progress: 0 })
//         .call(() => {
//             console.log("Timer ended, closing menu...");
//             // Optional: You can treat this as an 'Incorrect' move 
//             // by calling this.handleIncorrectMove() if you want!
//             this.closeSelectionMenu();
//         })
//         .start();
// }

    private showHandOnCorrectMenuItem() {
        const hand = GridController.globalHandNode;
        if (!hand || !this.selectionMenu) return;
        const targetItem = this.selectionMenu.getChildByName(this.correctItemName);
        if (targetItem) {
            GridController.isHandShowing = true;
            hand.active = true;
            hand.setSiblingIndex(999);
            hand.setWorldPosition(v3(targetItem.worldPosition.x + 10, targetItem.worldPosition.y - 50, 0));
            hand.setScale(v3(0, 0, 0));
            tween(hand).to(0.2, { scale: GridController.initialHandScale }, { easing: 'backOut' }).call(() => this.playHandAnimation()).start();
            Tween.stopAllByTarget(targetItem);
            const savedScale = this.menuItemScales.get(targetItem.name) || v3(1, 1, 1);
            tween(targetItem).to(0.5, { scale: v3(savedScale.x * 1, savedScale.y * 1, 1) }, { easing: 'sineInOut' }).to(0.5, { scale: savedScale }, { easing: 'sineInOut' }).union().repeatForever().start();
        }
    }

    onMenuItemClicked(event: Event) {
        if (GridController.isGameOver) return;
        event.propagationStopped = true;
        this.checkTapProgress(); 

        GridController.idleTimer = 0;
          if (this.selectionTimerBar) Tween.stopAllByTarget(this.selectionTimerBar);
        const clickedNode = event.target as Node;
        if (clickedNode.name === this.correctItemName) this.handleSuccessMove(clickedNode);
        else this.handleIncorrectMove();
    }

   private handleSuccessMove(itemNode: Node) {
    this.hideTutorialElements("Match Success");
    if (this.winMatchClip && GridController.fxSource) {
        GridController.fxSource.playOneShot(this.winMatchClip, 1);
    }

    // --- POP TICKS (RIGHT MARKS) ON ALL RELATED HINTS ---
    // if (this.rightNode) {
    //     this.rightNode.active = true;
    //     this.rightNode.setScale(v3(0, 0, 0));
    //     tween(this.rightNode).to(0.3, { scale: v3(1, 1, 1) }, { easing: 'backOut' }).start();
    // }
    
    if (this.extraRightNodes && this.extraRightNodes.length > 0) {
        this.extraRightNodes.forEach(mark => {
            if (mark) {
                mark.active = true;
                mark.setScale(v3(0, 0, 0));
                tween(mark).to(0.3, { scale: v3(1, 1, 1) }, { easing: 'backOut' }).start();
            }
        });
    }

    const spriteFrame = itemNode.getComponent(Sprite)?.spriteFrame;
    const itemTrans = itemNode.getComponent(UITransform);
    const sourceSize = itemTrans!.contentSize.clone();
    const sourceScale = itemNode.scale.clone();
    const startPos = itemNode.worldPosition.clone();
    const endPos = this.node.worldPosition.clone();
    
    const flyNode = new Node("FlyingItem");
    director.getScene()?.getChildByName("Canvas")?.addChild(flyNode);
    const flyTrans = flyNode.addComponent(UITransform);
    flyTrans.setContentSize(sourceSize);
    const flySprite = flyNode.addComponent(Sprite);
    flySprite.spriteFrame = spriteFrame!;
    flySprite.sizeMode = Sprite.SizeMode.CUSTOM;
    
    flyNode.setWorldPosition(startPos);
    flyNode.setScale(sourceScale);
    
    this.closeSelectionMenu();
    this.executeFlyingMovement(flyNode, endPos, spriteFrame!, sourceSize, sourceScale, startPos);
}
    private executeFlyingMovement(flyNode: Node, endPos: Vec3, spriteFrame: SpriteFrame, finalSize: Size, finalScale: Vec3, itemStartPos: Vec3) {
        tween(flyNode).parallel(
            tween().to(0.55, { worldPosition: endPos }, { easing: 'cubicOut' }),
            tween().to(0.55, { scale: finalScale }, { easing: 'elasticOut' })
        ).call(() => {
            this.hideSelectedFrame();
            this.isSolved = true;
            const gridSprite = this.getComponent(Sprite);
            const gridTrans = this.getComponent(UITransform);
            if (gridSprite && gridTrans) {
                gridSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                gridSprite.spriteFrame = spriteFrame;
                gridSprite.color = Color.WHITE;
                gridTrans.setContentSize(finalSize.width, finalSize.height);
                this.node.setScale(finalScale);
            }
            if (this.decorationNode) {
                this.decorationNode.active = true;
                const decTrans = this.decorationNode.getComponent(UITransform);
                if (decTrans) decTrans.setContentSize(this.decorOriginalSize.width, this.decorOriginalSize.height);
                this.decorationNode.setScale(v3(0, 0, 0));
                tween(this.decorationNode).to(0.4, { scale: this.decorOriginalScale }, { easing: 'backOut' }).start();
            }
            this.playBurst();
            // Start rotation effect at the grid box location and keep it running
            this.playSuccessRotation(endPos);
            flyNode.destroy();
            GridController.matchesMade++;
            this.trackProgression();
            this.handleHintFeedback(() => {
                this.scheduleOnce(() => {
                    if (this.hiddenCluesToUnlock.length > 0) this.revealNewClues();
                    if (GridController.matchesMade >= this.totalMatchesNeeded) {
                        GridController.isTimerStarted = false;
                        this.scheduleOnce(() => this.handleGameOver("WIN"), 0);
                    }
                }, );
            });
        }).start();
    }

    private trackProgression() {
        const progress = (GridController.matchesMade / this.totalMatchesNeeded);
        if (progress >= 0.75 && !GridController.hasPassed75) {
            GridController.hasPassed75 = true;
            Analytics.instance?.dispatchEvent(analyticsEvents.CHALLENGE_PASS_75);
        } else if (progress >= 0.50 && !GridController.hasPassed50) {
            GridController.hasPassed50 = true;
            Analytics.instance?.dispatchEvent(analyticsEvents.CHALLENGE_PASS_50);
        } else if (progress >= 0.25 && !GridController.hasPassed25) {
            GridController.hasPassed25 = true;
            Analytics.instance?.dispatchEvent(analyticsEvents.CHALLENGE_PASS_25);
        }
    }

    private resolveHintContainer(): Node | null {
        if (this.hintContainer?.isValid) {
            if (this.hintContainer.name === "Hints") return this.hintContainer;

            const parent = this.hintContainer.parent;
            if (parent?.isValid && parent.name === "Hints") return parent;
        }

        if (this.associatedHint?.isValid) {
            const parent = this.associatedHint.parent;
            if (parent?.isValid && parent.name === "Hints") return parent;
        }

        return this.hintContainer?.isValid ? this.hintContainer : null;
    }

    private cacheHintOriginalScales() {
        const hintContainer = this.resolveHintContainer();
        if (!hintContainer?.isValid) return;

        hintContainer.children.forEach(hint => {
            if (!GridController.hintOriginalScales.has(hint)) {
                GridController.hintOriginalScales.set(hint, hint.scale.clone());
            }
        });
    }

    private getHintOriginalScale(hint: Node): Vec3 {
        let scale = GridController.hintOriginalScales.get(hint);
        if (!scale) {
            scale = hint.scale.clone();
            GridController.hintOriginalScales.set(hint, scale);
        }
        return scale.clone();
    }

    private getHintRevealScale(targetNode?: Node): Vec3 {
        if (targetNode?.isValid) {
            const targetScale = this.getHintOriginalScale(targetNode);
            if (targetScale.x > 0.01 && targetScale.y > 0.01) {
                return targetScale;
            }
        }

        const hintContainer = this.resolveHintContainer();
        if (hintContainer?.isValid) {
            const existingHint = hintContainer.children.find(child =>
                child.isValid &&
                child.active &&
                child !== targetNode &&
                this.getHintOriginalScale(child).x > 0.01 &&
                this.getHintOriginalScale(child).y > 0.01
            );
            if (existingHint) {
                return this.getHintOriginalScale(existingHint);
            }
        }

        if (this.associatedHint?.isValid && this.associatedHint.active && this.associatedHint.scale.x > 0.01) {
            return this.associatedHint.scale.clone();
        }

        return this.originalHintScale.clone();
    }

private revealNewClues() {
    if (!this.hiddenCluesToUnlock || this.hiddenCluesToUnlock.length === 0) return;
    const revealingClues = this.hiddenCluesToUnlock.filter(clue => clue?.isValid);
    if (revealingClues.length === 0) {
        this.hiddenCluesToUnlock = [];
        return;
    }

    this.showPlusOneBubble(revealingClues.length);

    revealingClues.forEach(clue => {
        clue.active = true;
        (clue.getComponent(UIOpacity) || clue.addComponent(UIOpacity)).opacity = 0; 
    });

    this.repositionHints(new Set(revealingClues), () => {
        revealingClues.forEach((realClue, index) => {
            const finalPos = realClue.worldPosition.clone();
            const targetScale = this.getHintRevealScale(realClue);
            const flyer = instantiate(realClue);
            director.getScene()?.getChildByName("Canvas")?.addChild(flyer);
            (flyer.getComponent(UIOpacity) || flyer.addComponent(UIOpacity)).opacity = 255;

            flyer.setWorldPosition(this.node.worldPosition);
            flyer.setScale(v3(0, 0, 1));
            flyer.angle = -30;

            tween(flyer)
                .delay(index * 0.2) 
                .parallel(
                    // Path follows smooth deceleration arc
                    tween().to(0.9, { worldPosition: finalPos }, { easing: 'cubicOut' }),
                    // Angle settles smoothly
                    tween().to(0.9, { angle: 0 }, { easing: 'quadOut' }),
                    // Scale bounces in naturally
                    tween().to(0.8, { scale: targetScale }, { easing: 'elasticOut' })
                )
                .call(() => {
                    flyer.destroy(); 
                    if (realClue?.isValid) {
                        realClue.getComponent(UIOpacity)!.opacity = 255;
                        realClue.setScale(targetScale);
                        
                        // Sound/Voice trigger when the last clue 'snaps' into place
                        if (index === revealingClues.length - 1) {
                            this.playNextAvailableVoice();
                        }
                    }
                })
                .start();
        });
        this.hiddenCluesToUnlock = [];
    }); 
}

    private showPlusOneBubble(count: number = 1) {
        const bubble = new Node("PlusOneBubble");
        director.getScene()?.getChildByName("Canvas")?.addChild(bubble);
        bubble.setWorldPosition(v3(this.node.worldPosition.x, this.node.worldPosition.y + 64, 0));
        bubble.setSiblingIndex(999);
        bubble.setScale(v3(0, 0, 0));
        const g = bubble.addComponent(Graphics);
        g.fillColor = new Color().fromHEX('#64DD17');
        g.roundRect(-70, -25, 140, 50, 25);
        g.fill();
        const labelNode = new Node("Text");
        bubble.addChild(labelNode);
        const l = labelNode.addComponent(Label);
        l.string = count > 1 ? `+${count} New Clues!` : "+1 New Clue!";
        l.fontSize = 20;
        l.color = Color.WHITE;
        tween(bubble).to(0.3, { scale: v3(0.71, 0.71, 0.71) }, { easing: 'backOut' }).delay(1.2).to(0.3, { scale: v3(0, 0, 0) }).call(() => bubble.destroy()).start();
    }

    private getHintChild(targetNode: Node, names: string[]): Node | null {
        for (const name of names) {
            const child = targetNode.getChildByName(name);
            if (child) return child;
        }
        return null;
    }

    private handleHintFeedback(onComplete: Function) {
    const hintTargets: Node[] = [];
    if (this.associatedHint) hintTargets.push(this.associatedHint);
    
    if (this.extraHintsToClear) {
        this.extraHintsToClear.forEach(h => { if (h && hintTargets.indexOf(h) === -1) hintTargets.push(h); });
    }

    // --- LOGIC FOR NODE 9 (NO HINTS TO CLEAR) ---
    if (hintTargets.length === 0) { 
        console.log(`[GRID] No hints to clear for box ${this.node.name}. Proceeding to reveal logic...`);
        onComplete(); 
        if (!this.hiddenCluesToUnlock || this.hiddenCluesToUnlock.length === 0) {
            this.playNextAvailableVoice();
        }
        return; 
    }

    // Identify which hints can ACTUALLY be removed
    const hintsToRemove = hintTargets.filter(targetNode => {
        const isStillNeededByOther = GridController.allBoxes.some(otherBox =>
            otherBox !== this && !otherBox.isSolved && (otherBox.associatedHint === targetNode || (otherBox.extraHintsToClear && otherBox.extraHintsToClear.indexOf(targetNode) !== -1))
        );
        return !isStillNeededByOther;
    });

    // Pop checkmarks/ticks immediately on all cards involved
    hintTargets.forEach((h) => {
        const tick = this.getHintChild(h, ["RightNode", "Checkmark", "Tick", "TickMark"]);
        if (tick) {
            tick.active = true;
            tick.setScale(v3(0, 0, 0));
            tween(tick).to(0.3, { scale: v3(1, 1, 1) }, { easing: 'backOut' }).start();
        }
    });

    if (hintsToRemove.length === 0) { onComplete(); return; }

    // FLY OUT ANIMATION
    hintsToRemove.forEach((card, index) => {
        const pin = this.getHintChild(card, ["Pin", "pin", "PinNode"]);
        if (pin) {
            const pinOp = pin.getComponent(UIOpacity) || pin.addComponent(UIOpacity);
            tween(pinOp).to(0.25, { opacity: 0 }).start();
        }

        tween(card)
            .delay(0.4 + (0.15 * index))
            // 1. ANTICIPATION: Small shake/upwards movement
            .to(0.15, { angle: -5, scale: v3(0.3, 0.3, 1) }, { easing: 'sineOut' })
            // 2. RELEASE: Fly away with Cubic easing
            .parallel(
                tween().to(0.7, { position: v3(card.position.x - 900, card.position.y + 400, 0) }, { easing: 'cubicIn' }),
                tween().to(0.7, { angle: 45, scale: v3(0, 0, 1) })
            )
            .call(() => {
                card.active = false;
                if (index === hintsToRemove.length - 1) {
                    this.repositionHints();
                    if (!this.hiddenCluesToUnlock || this.hiddenCluesToUnlock.length === 0) {
                        this.playNextAvailableVoice();
                    }
                    onComplete();
                }
            }).start();
    });
}

  private playNextAvailableVoice() {
    if (GridController.isGameOver) return;

    GridController.allBoxes.forEach(box => box.unschedule(box.executeVoiceCall));
    this.scheduleOnce(this.executeVoiceCall, 0.5);
}

private executeVoiceCall() {
    if (GridController.isGameOver) return;

    // FIND THE FIRST UNSOLVED BOX WITH AN ACTIVE HINT
    // This is shared across all instances
    const nextBox = GridController.allBoxes.find(box => 
        !box.isSolved && 
        box.associatedHint && 
        box.associatedHint.active === true && 
        box.hintVoiceClip
    );

    if (nextBox && GridController.fxSource) {
        console.log(`[AUDIO] Playing voice for: ${nextBox.node.name}`);
        GridController.fxSource.stop(); // Stop current before starting new
        GridController.fxSource.clip = nextBox.hintVoiceClip;
        GridController.fxSource.volume = 1.0;
        GridController.fxSource.play();
    }
}

    private showRedFrame() {
        let frameNode = this.node.getChildByName("ErrorFrame");
        if (!frameNode) { frameNode = new Node("ErrorFrame"); this.node.addChild(frameNode); }
        const graphics = frameNode.getComponent(Graphics) || frameNode.addComponent(Graphics);
        const uiOpacity = frameNode.getComponent(UIOpacity) || frameNode.addComponent(UIOpacity);
        frameNode.active = true;
        uiOpacity.opacity = 255;
        const uiTrans = this.node.getComponent(UITransform);
        const w = uiTrans ? uiTrans.contentSize.width : 100;
        const h = uiTrans ? uiTrans.contentSize.height : 100;
        graphics.clear(); graphics.lineWidth = 12; graphics.strokeColor = Color.RED; graphics.rect(-w / 2, -h / 2, w, h); graphics.stroke();
        tween(frameNode).to(0.1, { scale: v3(1.05, 1.05, 1) }).to(0.1, { scale: v3(1, 1, 1) }).start();
        tween(uiOpacity).to(0.1, { opacity: 100 }).to(0.1, { opacity: 255 }).to(0.1, { opacity: 100 }).to(0.1, { opacity: 255 }).delay(0.6).to(0.2, { opacity: 0 }).call(() => { frameNode!.active = false; }).start();
    }

    private handleIncorrectMove() {
        this.hideTutorialElements("User Choice - Incorrect");
        this.showRedFrame();
        if (this.wrongMatchClip && GridController.fxSource) {
            GridController.fxSource.playOneShot(this.wrongMatchClip, 1);
        }
        const pos = this.selectionMenu.position.clone();
        tween(this.selectionMenu).by(0.05, { position: v3(12, 0, 0) }).by(0.05, { position: v3(-24, 0, 0) }).by(0.05, { position: v3(24, 0, 0) }).by(0.05, { position: v3(-12, 0, 0) }).call(() => { this.selectionMenu.setPosition(pos); this.closeSelectionMenu(); }).start();
        if (GridController.currentMistakes < this.heartSprites.length) {
            const currentHeart = this.heartSprites[GridController.currentMistakes];
            if (currentHeart && this.brokenHeartFrame) {
                tween(currentHeart.node).to(0.1, { scale: v3(0.51, 0.51, 1) }).call(() => currentHeart.spriteFrame = this.brokenHeartFrame).to(0.1, { scale: v3(0.4, 0.4, 1) }).start();
            }
            GridController.currentMistakes++;
            if (GridController.currentMistakes >= this.heartSprites.length) this.handleGameOver("OUT OF LIVES");
        }
    }

    private handleGameOver(reason: string) {
        if (GridController.isGameOver) return;
        Analytics.instance?.dispatchEvent(reason === "WIN" ? analyticsEvents.CHALLENGE_SOLVED : analyticsEvents.CHALLENGE_FAILED);
        GridController.isGameOver = true;
        GridController.isTimerStarted = false;
        if (GridController.bgmSource) GridController.bgmSource.stop();
        if (GridController.fxSource) GridController.fxSource.stop();
        this.hideTutorialElements("Final CTA Show");
        this.closeSelectionMenu();
        if (this.guideNode) { Tween.stopAllByTarget(this.guideNode); this.guideNode.active = false; }

        this.triggerGameEndCTA(reason);
    }

    private triggerGameEndCTA(reason: string) {
        this.scheduleOnce(() => {
            const endScreen = GridController.globalCtaEndScreen || this.ctaEndScreen || director.getScene()?.getChildByPath("Canvas/CTA");

            if (endScreen) {
                console.log(`[GAME OVER CTA] ${reason}. Showing CTA screen.`);
                Analytics.instance?.dispatchEvent(analyticsEvents.ENDCARD_SHOWN);
                endScreen.active = true;
                endScreen.setScale(v3(0, 0, 0));
                endScreen.setSiblingIndex(999);
                tween(endScreen).to(0.5, { scale: v3(1, 1, 1) }, { easing: 'backOut' }).start();
            } else {
                console.warn("[GAME OVER CTA] CTA screen not found. Falling back to direct redirect.");
                const ctaButtonNode = director.getScene()?.getChildByPath("Canvas/CTA/play_now_pink-removebg-preview");
                const ctaHandler = ctaButtonNode?.getComponent(CTAButtonHandler);
                if (ctaHandler) {
                    ctaHandler.onStoreButtonClicked();
                }
            }
        }, 0.15);
    }

    public closeSelectionMenu() {
        if (this.selectionMenu) { this.selectionMenu.active = false;
             if (this.selectionTimerBar) Tween.stopAllByTarget(this.selectionTimerBar);
         }
        this.hideSelectedFrame();
        if (GridController.activeBox === this) GridController.activeBox = null;
    }

    public hideTutorialElements(reason: string = "Automatic") {
        GridController.idleTimer = 0;
        GridController.isHandShowing = false;
        GridController.allBoxes.forEach(box => {
            if (!box.isSolved) box.applyPulse(box.node, false);
            if (box.selectionMenu) {
                box.selectionMenu.children.forEach(item => {
                    const savedScale = box.menuItemScales.get(item.name) || box.originalMenuItemScale;
                    item.setScale(savedScale);
                });
            }
        });
        if (GridController.globalHandNode) {
            Tween.stopAllByTarget(GridController.globalHandNode);
            GridController.globalHandNode.setScale(v3(0, 0, 0));
            GridController.globalHandNode.active = false;
        }
    }

    
  private showIdleHint() {
    if (GridController.isGameOver || !GridController.globalHandNode) return;
    if (GridController.isHandShowing) return;

    GridController.isHandShowing = true;
    
     // --- ADDED THIS: Show the dotted selection frame ---
    // this.showSelectedFrame();

    // Always pulse the Grid Box
    this.applyPulse(this.node, true);

    // ONLY pulse the hint card if it exists (Node 9 will skip this safely)
    if (this.associatedHint && this.associatedHint.active) {
        this.applyPulse(this.associatedHint, true);
    }

    this.playNextAvailableVoice();
    const hand = GridController.globalHandNode;
    hand.active = true;
    hand.setSiblingIndex(999);
    
    // Move hand to the grid cell
    const targetPos = this.node.worldPosition;
    hand.setWorldPosition(v3(targetPos.x + 50, targetPos.y - 90, 0));

    hand.setScale(v3(0, 0, 0));
    tween(hand)
        .to(0.3, { scale: GridController.initialHandScale }, { easing: 'backOut' })
        .call(() => this.playHandAnimation())
        .start();
}

private playHandAnimation() {
    const hand = GridController.globalHandNode;
    if (!hand || !hand.isValid) return;
    const handSprite = hand.getComponent(Sprite);
    const startScale = GridController.initialHandScale.clone();
    const clickScale = v3(startScale.x * 0.82, startScale.y * 0.82, 1);

    Tween.stopAllByTarget(hand);

    tween(hand)
        .repeatForever(
            tween()
                .call(() => {
                    if (handSprite?.isValid) handSprite.spriteFrame = GridController.globalHandIdle!;
                    hand.setScale(startScale);
                })
                .delay(0.9) // Wait before clicking
                .call(() => {
                    // 1. Swap to click sprite
                    if (handSprite?.isValid) handSprite.spriteFrame = GridController.globalHandClick!;
                    
                    // 2. TRIGGER THE YELLOW RIPPLE HERE
                    // Place the ripple just to the right of the hand so it feels attached to the tap
                    const fingerTipPos = v3(hand.worldPosition.x - 20, hand.worldPosition.y + 45, 0);
                    this.spawnClickRipple(fingerTipPos);
                })
                .to(0.12, { scale: clickScale }, { easing: 'quadOut' }) // Smooth press
                .delay(0.12)
                .to(0.24, { scale: startScale }, { easing: 'elasticOut' })  // Smooth elastic release
                .call(() => {
                    if (handSprite?.isValid) handSprite.spriteFrame = GridController.globalHandIdle!;
                })
                .delay(0.6) // Pause between taps
        )
        .start();
}

private repositionHints(skipOpacityFade: Set<Node> = new Set(), onComplete?: Function) {
    const hintContainer = this.resolveHintContainer();
    if (!hintContainer) {
        if (onComplete) onComplete();
        return;
    }
    this.cacheHintOriginalScales();
    const layout = hintContainer.getComponent(Layout);
    if (layout) layout.enabled = false;

    // We only care about active hints that are NOT currently in a "destroying" state
    const activeHints = hintContainer.children.filter(c => c.active && c.scale.x > 0.1);
    if (activeHints.length === 0) {
        if (onComplete) onComplete();
        return;
    }
    
    const MAX_WIDTH = 780; 
    const gapX = 25; // Slightly increased for breathing room
    const gapY = 30;
    let rows: Node[][] = [[]]; 
    let rowWidths: number[] = [0];

    // --- GRID CALCULATION ---
    activeHints.forEach((h) => {
        const hTrans = h.getComponent(UITransform);
        const targetScale = this.getHintOriginalScale(h);
        const w = hTrans ? hTrans.contentSize.width * targetScale.x : 200; // Accurate width after scale
        
        if (rowWidths[rows.length - 1] + w + gapX > MAX_WIDTH && rows[rows.length - 1].length > 0) {
            rows.push([h]); 
            rowWidths.push(w);
        } else {
            const lastIdx = rows.length - 1;
            rowWidths[lastIdx] += (rows[lastIdx].length > 0 ? gapX : 0) + w;
            rows[lastIdx].push(h);
        }
    });

    // --- ANIMATION EXECUTION ---
    let currentY = 150;
    let pendingMoves = activeHints.length;
    const finishMove = () => {
        pendingMoves--;
        if (pendingMoves <= 0 && onComplete) onComplete();
    };

    rows.forEach((rowNodes, rowIndex) => {
        const totalWidth = rowWidths[rowIndex];
        const rowStartX = -(totalWidth / 2);
        let xOff = 0;
        let rowMaxH = 0;

        rowNodes.forEach((h, index) => {
            const hTrans = h.getComponent(UITransform);
            const targetScale = this.getHintOriginalScale(h);
            const w = hTrans ? hTrans.contentSize.width * targetScale.x : 200;
            const tx = rowStartX + xOff + (w / 2);
            const ty = currentY;

            // --- SMOOTH REPOSITIONING ---
            // 1. Stop previous animations to prevent "fighting" tweens
            Tween.stopAllByTarget(h);

            // 2. Natural elastic bounce settle for smooth feel
            tween(h)
                .delay(index * 0.06) // Slightly longer stagger for wave effect
                .to(0.75, { 
                    position: v3(tx, ty, 0),
                    scale: targetScale
                }, { 
                    easing: 'elasticOut' // Smooth elastic bounce
                })
                .call(finishMove)
                .start();

            // Handle opacity fade-in smoothly
            const opacityComp = h.getComponent(UIOpacity) || h.addComponent(UIOpacity);
            if (opacityComp.opacity < 255 && !skipOpacityFade.has(h)) {
                tween(opacityComp)
                    .delay(index * 0.06)
                    .to(0.5, { opacity: 255 }, { easing: 'quadOut' })
                    .start();
            }

            xOff += w + gapX;
            const actualH = hTrans ? hTrans.contentSize.height * targetScale.y : 200;
            if (actualH > rowMaxH) rowMaxH = actualH;
        });
        currentY -= (rowMaxH + gapY);
    });
}

    private playBurst() {
        for (let i = 0; i < 8; i++) {
            const target = v3(Math.cos((i / 8) * Math.PI * 2) * 75, Math.sin((i / 8) * Math.PI * 2) * 75, 0);
            const s = new Node("Burst"); this.node.addChild(s);
            const g = s.addComponent(Graphics); g.fillColor = new Color().fromHEX('#C6F34C');
            const r = 14; g.moveTo(0, r); g.lineTo(r * 0.3, r * 0.3); g.lineTo(r, 0); g.lineTo(r * 0.3, -r * 0.3); g.lineTo(0, -r); g.lineTo(-r * 0.3, -r * 0.3); g.lineTo(-r, 0); g.lineTo(-r * 0.3, r * 0.3); g.close(); g.fill();
            tween(s).parallel(tween().by(0.6, { position: target }, { easing: 'sineOut' }), tween().to(0.6, { scale: v3(3, 3, 3) }), tween().by(0.6, { angle: 180 })).call(() => s.destroy()).start();
        }
    }

    private playSuccessRotation(gridBoxWorldPos: Vec3) {
        if (!this.successRotationEffect) return;
        
        Tween.stopAllByTarget(this.successRotationEffect);
        this.successRotationEffect.active = true;
        this.successRotationEffect.angle = 0;
        
        // Position the effect at the grid box location (behind the item)
        this.successRotationEffect.setWorldPosition(gridBoxWorldPos);
        // Set sibling index to be behind the grid item (but still visible)
        const canvas = director.getScene()?.getChildByPath("Canvas");
        if (canvas) {
            this.successRotationEffect.parent = canvas;
            this.successRotationEffect.setSiblingIndex(Math.max(0, canvas.children.length - 100)); // Behind most UI but visible
        }
        
        // Rotate for 1.5 seconds while the item settles
        tween(this.successRotationEffect)
            .to(1.5, { angle: 360 }, { easing: 'sineOut' })
            .call(() => {
                this.successRotationEffect.active = false;
            })
            .start();
    }

    onDestroy() {
        const idx = GridController.allBoxes.indexOf(this);
        if (idx > -1) GridController.allBoxes.splice(idx, 1);
        if (GridController.timerMaster === this) GridController.timerMaster = null;
    }

    public onCTAClicked() {
        Analytics.instance?.dispatchEvent(analyticsEvents.CTA_CLICKED);
    }

    
}
