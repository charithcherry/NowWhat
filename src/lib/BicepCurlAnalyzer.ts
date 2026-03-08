/**
 * Bicep Curl Analyzer
 *
 * Validates:
 * 1. Straight posture (back/head alignment)
 * 2. Arms close to body (0° angle between body and bicep area)
 * 3. Full body visibility
 * 4. Proper rep counting based on elbow flexion
 */

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface BicepCurlMetrics {
  repCount: number;
  currentAngle: { left: number; right: number };
  formScore: number;
  postureScore: number;
  armPositionScore: number;
  visibilityScore: number;
  feedback: string[];
  isInValidPosition: boolean;
  phase: 'down' | 'up' | 'neutral';
}

export interface PostureAnalysis {
  isPostureStraight: boolean;
  backAngle: number;
  headAlignment: number;
  issues: string[];
}

export interface ArmPositionAnalysis {
  isArmCloseToBody: boolean;
  leftArmBodyAngle: number;
  rightArmBodyAngle: number;
  issues: string[];
}

export class BicepCurlAnalyzer {
  private repCount: number = 0;
  private lastAngle: { left: number; right: number } = { left: 180, right: 180 };
  private phase: 'down' | 'up' | 'neutral' = 'down';
  private repStarted: boolean = false;
  private logCallback?: (message: string) => void;

  // Thresholds (based on real-world testing - matching JavaScript implementation)
  private readonly MIN_ANGLE_DOWN = 160; // Arm fully extended (buffer from 180)
  private readonly MAX_ANGLE_UP = 30;    // Arm fully flexed (realistic threshold)
  private readonly ARM_BODY_MAX_ANGLE = 15; // Max angle between arm and body (close to 0)
  private readonly MIN_VISIBILITY = 0.5; // Minimum landmark visibility
  private readonly BACK_STRAIGHT_THRESHOLD = 170; // Shoulder-hip-knee angle for straight back

  // MediaPipe Pose landmark indices
  private readonly LANDMARKS = {
    NOSE: 0,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
  };

  constructor(logCallback?: (message: string) => void) {
    this.logCallback = logCallback;
  }

  /**
   * Set the logging callback
   */
  setLogCallback(callback: (message: string) => void): void {
    this.logCallback = callback;
  }

  /**
   * Internal logging method with timestamp and formatting
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[BICEP CURL] ${timestamp} | ${message}`;

    // Log to console
    console.log(logMessage);

    // Call external callback if provided
    if (this.logCallback) {
      this.logCallback(logMessage);
    }
  }

  /**
   * Main analysis function - call this with each frame's landmarks
   */
  analyze(landmarks: PoseLandmark[]): BicepCurlMetrics {
    const feedback: string[] = [];

    // 1. Check full body visibility
    const visibilityCheck = this.checkFullBodyVisibility(landmarks);
    if (!visibilityCheck.isVisible) {
      return {
        repCount: this.repCount,
        currentAngle: this.lastAngle,
        formScore: 0,
        postureScore: 0,
        armPositionScore: 0,
        visibilityScore: 0,
        feedback: visibilityCheck.issues,
        isInValidPosition: false,
        phase: this.phase,
      };
    }

    // 2. Check posture (straight back and head alignment)
    const postureAnalysis = this.analyzePosture(landmarks);
    if (!postureAnalysis.isPostureStraight) {
      feedback.push(...postureAnalysis.issues);
    }

    // 3. Check arm position (should be close to body)
    const armPositionAnalysis = this.analyzeArmPosition(landmarks);
    if (!armPositionAnalysis.isArmCloseToBody) {
      feedback.push(...armPositionAnalysis.issues);
    }

    // 4. Calculate elbow angles for rep counting
    const leftShoulder = landmarks[this.LANDMARKS.LEFT_SHOULDER];
    const leftElbow = landmarks[this.LANDMARKS.LEFT_ELBOW];
    const leftWrist = landmarks[this.LANDMARKS.LEFT_WRIST];
    const rightShoulder = landmarks[this.LANDMARKS.RIGHT_SHOULDER];
    const rightElbow = landmarks[this.LANDMARKS.RIGHT_ELBOW];
    const rightWrist = landmarks[this.LANDMARKS.RIGHT_WRIST];

    // Debug: Log landmark positions
    this.log(
      `LEFT - Shoulder: (${leftShoulder.x.toFixed(3)}, ${leftShoulder.y.toFixed(3)}) | ` +
      `Elbow: (${leftElbow.x.toFixed(3)}, ${leftElbow.y.toFixed(3)}) | ` +
      `Wrist: (${leftWrist.x.toFixed(3)}, ${leftWrist.y.toFixed(3)})`
    );
    this.log(
      `RIGHT - Shoulder: (${rightShoulder.x.toFixed(3)}, ${rightShoulder.y.toFixed(3)}) | ` +
      `Elbow: (${rightElbow.x.toFixed(3)}, ${rightElbow.y.toFixed(3)}) | ` +
      `Wrist: (${rightWrist.x.toFixed(3)}, ${rightWrist.y.toFixed(3)})`
    );

    const leftElbowAngle = this.calculateAngle(
      leftShoulder,
      leftElbow,
      leftWrist
    );

    const rightElbowAngle = this.calculateAngle(
      rightShoulder,
      rightElbow,
      rightWrist
    );

    // 5. Rep counting logic (using the better visible arm)
    const avgAngle = (leftElbowAngle + rightElbowAngle) / 2;

    // Log angles and current state
    this.log(
      `Left: ${Math.round(leftElbowAngle)}° | Right: ${Math.round(rightElbowAngle)}° | ` +
      `Avg: ${Math.round(avgAngle)}° | Phase: ${this.phase} | Reps: ${this.repCount}`
    );

    this.updateRepCount(avgAngle, feedback);

    // 6. Calculate scores
    const postureScore = this.calculatePostureScore(postureAnalysis);
    const armPositionScore = this.calculateArmPositionScore(armPositionAnalysis);
    const visibilityScore = visibilityCheck.score;
    const formScore = (postureScore + armPositionScore + visibilityScore) / 3;

    // Log scores and posture details
    this.log(
      `Scores - Form: ${Math.round(formScore)}% | Posture: ${Math.round(postureScore)}% | ` +
      `Arm Position: ${Math.round(armPositionScore)}% | Visibility: ${Math.round(visibilityScore)}%`
    );

    this.log(
      `Posture - Back Angle: ${Math.round(postureAnalysis.backAngle)}° | ` +
      `Head Alignment: ${postureAnalysis.headAlignment.toFixed(2)}% | ` +
      `Left Arm-Body: ${Math.round(armPositionAnalysis.leftArmBodyAngle)}° | ` +
      `Right Arm-Body: ${Math.round(armPositionAnalysis.rightArmBodyAngle)}°`
    );

    // 7. Check if in valid starting position
    const isInValidPosition =
      postureAnalysis.isPostureStraight &&
      armPositionAnalysis.isArmCloseToBody &&
      visibilityCheck.isVisible;

    // 8. Add form feedback
    if (formScore < 70) {
      feedback.push("⚠️ Improve form for better results");
    } else if (formScore >= 90) {
      feedback.push("✅ Excellent form!");
    }

    // Log feedback messages if any
    if (feedback.length > 0) {
      this.log(`Feedback: ${feedback.join(' | ')}`);
    }

    this.lastAngle = { left: leftElbowAngle, right: rightElbowAngle };

    return {
      repCount: this.repCount,
      currentAngle: { left: leftElbowAngle, right: rightElbowAngle },
      formScore: Math.round(formScore),
      postureScore: Math.round(postureScore),
      armPositionScore: Math.round(armPositionScore),
      visibilityScore: Math.round(visibilityScore),
      feedback,
      isInValidPosition,
      phase: this.phase,
    };
  }

  /**
   * Check if full body is visible in frame
   */
  private checkFullBodyVisibility(landmarks: PoseLandmark[]): {
    isVisible: boolean;
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    const requiredLandmarks = [
      { index: this.LANDMARKS.NOSE, name: 'Head' },
      { index: this.LANDMARKS.LEFT_SHOULDER, name: 'Left Shoulder' },
      { index: this.LANDMARKS.RIGHT_SHOULDER, name: 'Right Shoulder' },
      { index: this.LANDMARKS.LEFT_ELBOW, name: 'Left Elbow' },
      { index: this.LANDMARKS.RIGHT_ELBOW, name: 'Right Elbow' },
      { index: this.LANDMARKS.LEFT_WRIST, name: 'Left Wrist' },
      { index: this.LANDMARKS.RIGHT_WRIST, name: 'Right Wrist' },
      { index: this.LANDMARKS.LEFT_HIP, name: 'Left Hip' },
      { index: this.LANDMARKS.RIGHT_HIP, name: 'Right Hip' },
      { index: this.LANDMARKS.LEFT_ANKLE, name: 'Left Ankle' },
      { index: this.LANDMARKS.RIGHT_ANKLE, name: 'Right Ankle' },
    ];

    let visibleCount = 0;
    const missingParts: string[] = [];

    for (const landmark of requiredLandmarks) {
      const lm = landmarks[landmark.index];
      if (lm && lm.visibility > this.MIN_VISIBILITY) {
        visibleCount++;
      } else {
        missingParts.push(landmark.name);
      }
    }

    const visibilityScore = (visibleCount / requiredLandmarks.length) * 100;
    const isVisible = visibilityScore >= 80; // At least 80% of body should be visible

    if (!isVisible) {
      if (missingParts.includes('Left Ankle') || missingParts.includes('Right Ankle')) {
        issues.push("⚠️ Move back - can't see your ankles");
      }
      if (missingParts.includes('Head') || missingParts.includes('Nose')) {
        issues.push("⚠️ Move back - can't see your head");
      }
      if (missingParts.length > 0) {
        issues.push(`⚠️ Can't see: ${missingParts.join(', ')}`);
      }
      issues.push("📏 Move back to show your full body");
    }

    return { isVisible, score: visibilityScore, issues };
  }

  /**
   * Analyze posture - back and head should be straight
   * Uses shoulder-hip-knee angle like the JavaScript implementation
   */
  private analyzePosture(landmarks: PoseLandmark[]): PostureAnalysis {
    const issues: string[] = [];

    // Get landmarks
    const leftShoulder = landmarks[this.LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[this.LANDMARKS.RIGHT_SHOULDER];
    const leftHip = landmarks[this.LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[this.LANDMARKS.RIGHT_HIP];
    const leftKnee = landmarks[this.LANDMARKS.LEFT_KNEE];
    const rightKnee = landmarks[this.LANDMARKS.RIGHT_KNEE];
    const nose = landmarks[this.LANDMARKS.NOSE];

    // Calculate shoulder-hip-knee angle (right side) - for back straightness
    const rightBackAngle = this.calculateAngle(
      rightShoulder,
      rightHip,
      rightKnee
    );

    // Calculate shoulder-hip-knee angle (left side) - for symmetry
    const leftBackAngle = this.calculateAngle(
      leftShoulder,
      leftHip,
      leftKnee
    );

    // Average back angle
    const backAngle = (rightBackAngle + leftBackAngle) / 2;

    // Mid-shoulder point for head alignment check
    const midShoulder = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      z: (leftShoulder.z + rightShoulder.z) / 2,
      visibility: 1,
    };

    // Head alignment (nose should be centered above shoulders)
    const headAlignment = Math.abs((nose.x - midShoulder.x) * 100); // As percentage

    // Back should be straight: shoulder-hip-knee angle > 170 degrees
    const isPostureStraight =
      backAngle >= this.BACK_STRAIGHT_THRESHOLD &&
      headAlignment <= 10;

    if (backAngle < this.BACK_STRAIGHT_THRESHOLD) {
      issues.push(`📐 Stand straighter - back angle: ${Math.round(backAngle)}° (need ${this.BACK_STRAIGHT_THRESHOLD}°)`);
    }

    if (headAlignment > 10) {
      issues.push(`👤 Keep your head centered - offset: ${headAlignment.toFixed(1)}%`);
    }

    return {
      isPostureStraight,
      backAngle,
      headAlignment,
      issues,
    };
  }

  /**
   * Analyze arm position - arms should be close to body (0° angle)
   */
  private analyzeArmPosition(landmarks: PoseLandmark[]): ArmPositionAnalysis {
    const issues: string[] = [];

    // Left arm-body angle
    const leftArmBodyAngle = this.calculateArmBodyAngle(
      landmarks[this.LANDMARKS.LEFT_SHOULDER],
      landmarks[this.LANDMARKS.LEFT_ELBOW],
      landmarks[this.LANDMARKS.LEFT_HIP]
    );

    // Right arm-body angle
    const rightArmBodyAngle = this.calculateArmBodyAngle(
      landmarks[this.LANDMARKS.RIGHT_SHOULDER],
      landmarks[this.LANDMARKS.RIGHT_ELBOW],
      landmarks[this.LANDMARKS.RIGHT_HIP]
    );

    const isArmCloseToBody =
      leftArmBodyAngle <= this.ARM_BODY_MAX_ANGLE &&
      rightArmBodyAngle <= this.ARM_BODY_MAX_ANGLE;

    if (leftArmBodyAngle > this.ARM_BODY_MAX_ANGLE || rightArmBodyAngle > this.ARM_BODY_MAX_ANGLE) {
      issues.push(`💪 Keep elbows closer - left: ${Math.round(leftArmBodyAngle)}°, right: ${Math.round(rightArmBodyAngle)}° (max ${this.ARM_BODY_MAX_ANGLE}°)`);
    }

    return {
      isArmCloseToBody,
      leftArmBodyAngle,
      rightArmBodyAngle,
      issues,
    };
  }

  /**
   * Calculate angle between arm and body
   * Uses arctan2 method to calculate the angle between:
   * - Body line (shoulder to hip)
   * - Arm line (shoulder to elbow)
   * Returns the angle in degrees (0 = arm perfectly aligned with body)
   */
  private calculateArmBodyAngle(
    shoulder: PoseLandmark,
    elbow: PoseLandmark,
    hip: PoseLandmark
  ): number {
    if (!shoulder || !elbow || !hip) {
      return 0; // Return 0 if points are missing (treat as valid)
    }

    // Calculate angle using arctan2 method
    const radians =
      Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x) -
      Math.atan2(hip.y - shoulder.y, hip.x - shoulder.x);

    let angle = Math.abs(radians * (180 / Math.PI));

    // Normalize angle to 0-180 range
    if (angle > 180.0) {
      angle = 360 - angle;
    }

    // We want the acute angle (0-90 degrees)
    // If angle > 90, it means the arm is on the opposite side
    if (angle > 90) {
      angle = 180 - angle;
    }

    return angle;
  }

  /**
   * Calculate angle between three points (e.g., shoulder-elbow-wrist)
   * Uses arctan2 method similar to the Python implementation
   *
   * @param a - First point (e.g., shoulder)
   * @param b - Middle point (e.g., elbow) - the vertex of the angle
   * @param c - Third point (e.g., wrist)
   * @returns Angle in degrees
   */
  private calculateAngle(
    a: PoseLandmark,
    b: PoseLandmark,
    c: PoseLandmark
  ): number {
    // Handle missing or invalid points
    if (!a || !b || !c) {
      this.log("⚠️ Missing landmarks for angle calculation, returning 180°");
      return 180; // Return neutral angle if points are missing
    }

    // Calculate vectors from elbow (b) to shoulder (a) and wrist (c)
    const vec1 = { x: a.x - b.x, y: a.y - b.y };
    const vec2 = { x: c.x - b.x, y: c.y - b.y };

    // Calculate angle using arctan2 (same as Python implementation)
    const angle1 = Math.atan2(a.y - b.y, a.x - b.x);
    const angle2 = Math.atan2(c.y - b.y, c.x - b.x);
    const radians = angle2 - angle1;

    let angle = Math.abs(radians * (180 / Math.PI));

    // Normalize angle to 0-180 range
    if (angle > 180.0) {
      angle = 360 - angle;
    }

    // Debug: Log angle calculation details
    this.log(
      `Angle calc - vec1: (${vec1.x.toFixed(3)}, ${vec1.y.toFixed(3)}) | ` +
      `vec2: (${vec2.x.toFixed(3)}, ${vec2.y.toFixed(3)}) | ` +
      `angle1: ${(angle1 * 180 / Math.PI).toFixed(1)}° | ` +
      `angle2: ${(angle2 * 180 / Math.PI).toFixed(1)}° | ` +
      `result: ${angle.toFixed(1)}°`
    );

    return angle;
  }

  /**
   * Update rep count based on elbow angle changes
   * Matches JavaScript implementation logic:
   * - Down position: angle > 160
   * - Up position: angle < 30 (and previous stage was "down")
   */
  private updateRepCount(currentAngle: number, feedback: string[]): void {
    const previousPhase = this.phase;

    // Down position: arms extended (angle > 160)
    if (currentAngle > this.MIN_ANGLE_DOWN) {
      this.phase = 'down';
      this.repStarted = true;

      // Log phase transition
      if (previousPhase !== 'down') {
        this.log(`>>> PHASE TRANSITION: ${previousPhase} -> down | Angle: ${Math.round(currentAngle)}°`);
      }
    }

    // Up position: arms flexed (angle < 30) AND previous stage was "down"
    if (currentAngle < this.MAX_ANGLE_UP && this.phase === 'down' && this.repStarted) {
      this.phase = 'up';
      this.repCount++;
      feedback.push(`✅ Rep ${this.repCount} completed!`);

      // Log rep completion prominently
      this.log(`🎉 REP COUNTED! Rep #${this.repCount} | Angle: ${Math.round(currentAngle)}° | TRANSITION: down -> up`);
    }

    // Provide real-time phase feedback
    if (this.repStarted) {
      if (this.phase === 'down' && currentAngle < this.MIN_ANGLE_DOWN && currentAngle > this.MAX_ANGLE_UP + 20) {
        feedback.push("⬆️ Keep curling up");
      } else if (this.phase === 'up' && currentAngle > this.MAX_ANGLE_UP && currentAngle < this.MIN_ANGLE_DOWN - 20) {
        feedback.push("⬇️ Lower down slowly");
      }
    } else {
      if (currentAngle < this.MIN_ANGLE_DOWN) {
        feedback.push("💪 Extend arms fully to start");
      }
    }
  }

  /**
   * Calculate posture score (0-100)
   * Back angle should be >= 170 degrees for good posture
   */
  private calculatePostureScore(postureAnalysis: PostureAnalysis): number {
    // Back score: closer to 180 is better (perfectly straight)
    const backScore = postureAnalysis.backAngle >= this.BACK_STRAIGHT_THRESHOLD
      ? Math.min(100, ((postureAnalysis.backAngle - this.BACK_STRAIGHT_THRESHOLD) / (180 - this.BACK_STRAIGHT_THRESHOLD)) * 100 + 50)
      : Math.max(0, (postureAnalysis.backAngle / this.BACK_STRAIGHT_THRESHOLD) * 50);

    // Head score: centered above shoulders (headAlignment < 10%)
    const headScore = Math.max(0, 100 - (postureAnalysis.headAlignment / 10) * 50);

    return (backScore + headScore) / 2;
  }

  /**
   * Calculate arm position score (0-100)
   */
  private calculateArmPositionScore(armPositionAnalysis: ArmPositionAnalysis): number {
    const leftScore = Math.max(0, 100 - (armPositionAnalysis.leftArmBodyAngle / this.ARM_BODY_MAX_ANGLE) * 100);
    const rightScore = Math.max(0, 100 - (armPositionAnalysis.rightArmBodyAngle / this.ARM_BODY_MAX_ANGLE) * 100);
    return (leftScore + rightScore) / 2;
  }

  /**
   * Reset the analyzer
   */
  reset(): void {
    this.repCount = 0;
    this.phase = 'down';
    this.repStarted = false;
    this.lastAngle = { left: 180, right: 180 };
  }

  /**
   * Get current rep count
   */
  getRepCount(): number {
    return this.repCount;
  }
}
