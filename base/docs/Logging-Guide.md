# Bicep Curl Analyzer - Logging System

## Overview
Comprehensive logging has been added to track angles, rep counting, and form analysis in real-time during bicep curl exercises.

## What Gets Logged

### 1. **Elbow Angles** (Every Frame)
```
[BICEP CURL] 2026-03-07T... | Left: 165° | Right: 163° | Avg: 164° | Phase: down | Reps: 0
```

### 2. **Form Scores**
```
[BICEP CURL] 2026-03-07T... | Scores - Form: 85% | Posture: 90% | Arm Position: 80% | Visibility: 95%
```

### 3. **Posture Details**
```
[BICEP CURL] 2026-03-07T... | Posture - Back Angle: 175° | Head Alignment: 3.45% | Left Arm-Body: 8° | Right Arm-Body: 7°
```

### 4. **Phase Transitions**
```
[BICEP CURL] 2026-03-07T... | >>> PHASE TRANSITION: up -> down | Angle: 162°
```

### 5. **Rep Counting**
```
[BICEP CURL] 2026-03-07T... | 🎉 REP COUNTED! Rep #1 | Angle: 28° | TRANSITION: down -> up
```

### 6. **Feedback Messages**
```
[BICEP CURL] 2026-03-07T... | Feedback: ⬆️ Keep curling up | ✅ Excellent form!
```

## Log Locations

### Console
All logs are written to the browser console in real-time. Open DevTools to see them.

### Log File
Logs are also written to: `/Users/charithpurushotham/Desktop/Wats_Next/exercise-log.txt`

## UI Controls

### View Logs
Click the "View Logs" button to display all saved logs in the console.

### Clear Logs
Click the "Clear Logs" button to delete the log file and start fresh.

## API Endpoints

### POST `/api/log`
Write a log message to the file
```json
{
  "message": "[BICEP CURL] timestamp | log message"
}
```

### GET `/api/log`
Retrieve all logs
```json
{
  "logs": ["log line 1", "log line 2", ...]
}
```

### DELETE `/api/log`
Clear all logs

## How to Use

1. **Start Exercise**: Click "Start Exercise" - logging begins automatically
2. **Monitor Console**: Open browser DevTools > Console tab
3. **Monitor File**: View `exercise-log.txt` in the project root
4. **Analyze**: Review angles, phase transitions, and rep counting logic
5. **Clear**: Use "Clear Logs" button when needed

## Log Format

All logs follow this format:
```
[BICEP CURL] ISO_TIMESTAMP | MESSAGE
```

Example:
```
[BICEP CURL] 2026-03-07T12:34:56.789Z | Left: 165° | Right: 163° | Avg: 164° | Phase: down | Reps: 0
```

## Key Metrics to Watch

### Elbow Angles
- **Down position**: > 160° (arms extended)
- **Up position**: < 30° (arms fully curled)
- **Mid-range**: 30-160° (transitioning)

### Back Angle
- **Good posture**: ≥ 170° (straight back)
- **Poor posture**: < 170° (hunched)

### Arm-Body Angle
- **Good position**: ≤ 15° (elbows close to body)
- **Poor position**: > 15° (elbows flaring out)

### Form Scores
- **Excellent**: ≥ 90%
- **Good**: 70-89%
- **Poor**: < 70%

## Debugging Tips

1. **Rep not counting?**
   - Check if angle goes below 30° (full curl)
   - Check if angle goes above 160° first (full extension)
   - Look for "PHASE TRANSITION" logs

2. **Wrong angles?**
   - Verify all landmarks are visible (visibility score)
   - Check camera positioning
   - Ensure full body is in frame

3. **Poor form scores?**
   - Review back angle (should be ≥ 170°)
   - Check arm-body angles (should be ≤ 15°)
   - Look for specific feedback messages

## Example Log Sequence (1 Rep)

```
[BICEP CURL] 2026-03-07T12:00:00.000Z | Left: 180° | Right: 178° | Avg: 179° | Phase: down | Reps: 0
[BICEP CURL] 2026-03-07T12:00:00.033Z | Scores - Form: 92% | Posture: 95% | Arm Position: 90% | Visibility: 91%
[BICEP CURL] 2026-03-07T12:00:00.033Z | Posture - Back Angle: 174° | Head Alignment: 2.10% | Left Arm-Body: 6° | Right Arm-Body: 5°

... (transitioning up) ...

[BICEP CURL] 2026-03-07T12:00:01.500Z | Left: 28° | Right: 29° | Avg: 28° | Phase: down | Reps: 0
[BICEP CURL] 2026-03-07T12:00:01.500Z | 🎉 REP COUNTED! Rep #1 | Angle: 28° | TRANSITION: down -> up
[BICEP CURL] 2026-03-07T12:00:01.500Z | >>> PHASE TRANSITION: down -> up | Angle: 28°

... (transitioning down) ...

[BICEP CURL] 2026-03-07T12:00:02.800Z | Left: 162° | Right: 164° | Avg: 163° | Phase: up | Reps: 1
[BICEP CURL] 2026-03-07T12:00:02.800Z | >>> PHASE TRANSITION: up -> down | Angle: 163°
```

## Troubleshooting

### Logs not appearing in file?
- Check that the Next.js app is running
- Verify file permissions in project root
- Check browser console for API errors

### Too many logs?
- Logs are written every frame (~30 fps)
- This is intentional for detailed analysis
- Use "Clear Logs" button to reset

### File getting too large?
- Clear logs periodically
- Or modify the API to rotate logs
- Consider implementing log levels (debug/info/error)

## Performance Notes

- Logging adds minimal overhead (~1-2ms per frame)
- Console logging is more performant than file writes
- File writes are async and non-blocking
- Consider disabling file logging in production
