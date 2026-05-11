package com.demo.controller;

import com.demo.model.TypingResult;
import com.demo.model.TypingResultResponse;
import com.demo.model.TypingTextResponse;
import com.demo.service.OpenAIService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api")
public class TypingController {

	// ── Fallback text pools (used when OpenAI is disabled or unavailable) ──
	private static final Map<String, List<String>> TEXT_POOL = new LinkedHashMap<>();

	static {
		TEXT_POOL.put("easy", Arrays.asList(
				"the cat sat on the mat and looked at the bird on the wall next to the old red door by the small house near the tree",
				"she sells sea shells by the sea shore and the shells she sells are sea shells she is quite sure about that fact today",
				"i like to eat cake and pie and ice cream on warm sunny days in the park with all my good friends and family",
				"the sun was bright and the sky was blue and the children played in the yard all day long having a lot of fun outside",
				"good food and clean water are two of the most important things you need to live a happy and healthy life every single day",
				"the big brown dog ran fast across the green field and jumped over the small wooden fence near the old red barn by the hill",
				"every morning she woke up early to watch the sunrise from her window with a hot cup of tea in her warm hands",
				"he opened the door and walked into the room where his friends were waiting for him with big smiles on their happy faces"
		));

		TEXT_POOL.put("medium", Arrays.asList(
				"The quick brown fox jumps over the lazy dog near the riverbank while birds sing softly in the tall oak trees above the water",
				"Programming is the art of solving problems through logical thinking and turning abstract ideas into real working software that people use every day",
				"Success is not about being the best but about always doing better than you did the day before in every area of your life",
				"The greatest adventure you can take is to live the life of your dreams while helping others achieve theirs along the way forward",
				"Technology shapes the world we live in and those who understand it have the power to change the future for everyone around them",
				"Reading books expands your mind and fills you with knowledge wisdom and empathy that no other activity can quite replicate in daily life",
				"Consistency and dedication over a long period of time will always outperform short bursts of motivation that fade away too quickly to matter",
				"The human brain is capable of extraordinary things when given the right environment and the proper encouragement and time it needs to grow"
		));

		TEXT_POOL.put("hard", Arrays.asList(
				"Perseverance through adversity cultivates extraordinary character while resilience transforms unprecedented challenges into remarkable opportunities for meaningful personal growth and development.",
				"Sophisticated algorithms efficiently process multidimensional datasets extracting statistically significant correlations between seemingly unrelated variables across distributed computational architectures.",
				"Quantum mechanics fundamentally challenges classical physics paradigms demonstrating that subatomic particles simultaneously inhabit multiple probabilistic states until directly observed and measured.",
				"Biochemical pathways orchestrate extraordinarily complex metabolic processes synthesizing essential macromolecules through enzymatic catalysis under precisely regulated physiological conditions throughout the body.",
				"Contemporary philosophical discourse examines existential phenomenology interrogating consciousness temporality and intersubjective experience through rigorous hermeneutical methodologies and critical intellectual analysis.",
				"The intricate interplay between neurological processes cognitive frameworks and environmental stimuli ultimately determines the full complexity of all observable human behavioral responses.",
				"Geopolitical transformations throughout recorded history demonstrate cyclical patterns of institutional evolution revolutionary upheaval and subsequent stabilization across all major civilizational boundaries.",
				"Cryptographic protocols employ sophisticated mathematical constructs including asymmetric encryption elliptic curve algorithms and zero knowledge proofs to ensure complete data integrity and security."
		));
	}

	private final OpenAIService openAIService;

	@Autowired
	public TypingController(OpenAIService openAIService) {
		this.openAIService = openAIService;
	}

	// ────────────────────────────────────────────────────────────
	// GET /api/text
	// ────────────────────────────────────────────────────────────
	@GetMapping("/text")
	public TypingTextResponse getTypingText(
			@RequestParam(defaultValue = "medium") String difficulty,
			@RequestParam(defaultValue = "time")   String mode,
			@RequestParam(defaultValue = "60")     int    duration,
			@RequestParam(defaultValue = "random") String topic) {

		// Validate difficulty
		String diff = difficulty.toLowerCase().trim();
		if (!TEXT_POOL.containsKey(diff)) {
			throw new IllegalArgumentException(
					"Unknown difficulty '" + difficulty + "'. Use: easy, medium, hard");
		}

		String text = null;

		// ── 1. Try OpenAI (if configured) ──────────────────────
		if (openAIService.isAvailable()) {
			int targetWords = estimateWordCount(mode, duration, diff);
			System.out.println("[OpenAI] Generating " + diff + "/" + topic
					+ " (~" + targetWords + " words)...");
			text = openAIService.generateText(diff, topic, targetWords);
			if (text != null) {
				System.out.println("[OpenAI] Generated: " + text.split("\\s+").length + " words.");
			} else {
				System.out.println("[OpenAI] Generation failed — falling back to text pool.");
			}
		}

		// ── 2. Fallback to text pool ───────────────────────────
		if (text == null) {
			List<String> pool = TEXT_POOL.get(diff);
			Random rand = new Random();
			text = pool.get(rand.nextInt(pool.size()));

			// Extend for longer tests
			if ("time".equals(mode) && duration >= 60) {
				String extra = pool.get(rand.nextInt(pool.size()));
				if (!extra.equals(text)) text = text + " " + extra;
			}
		}

		return new TypingTextResponse(text, diff, mode);
	}

	// ────────────────────────────────────────────────────────────
	// GET /api/info  — meta info for the frontend (optional)
	// ────────────────────────────────────────────────────────────
	@GetMapping("/info")
	public Map<String, Object> getInfo() {
		Map<String, Object> info = new LinkedHashMap<>();
		info.put("difficulties", Arrays.asList("easy", "medium", "hard"));
		info.put("modes",        Arrays.asList("time", "words"));
		info.put("timeOptions",  Arrays.asList(15, 30, 60, 120));
		info.put("wordOptions",  Arrays.asList(10, 25, 50, 100));
		info.put("topics",       Arrays.asList(
				"random","technology","nature","science","history",
				"sports","business","motivation","health"));
		info.put("openaiEnabled", openAIService.isAvailable());
		info.put("version", "2.0.0");
		return info;
	}

	// ────────────────────────────────────────────────────────────
	// POST /api/result
	// ────────────────────────────────────────────────────────────
	@PostMapping("/result")
	public TypingResultResponse saveResult(@RequestBody TypingResult result) {

		// Basic validation
		if (result.getWpm() < 0 || result.getAccuracy() < 0 || result.getAccuracy() > 100) {
			throw new IllegalArgumentException("Result contains invalid statistics.");
		}

		// Pretty console log
		System.out.println("\n╔══════════════════════════════╗");
		System.out.println("║     TYPING RESULT RECEIVED   ║");
		System.out.println("╠══════════════════════════════╣");
		System.out.printf( "║  WPM        : %-15d ║%n", result.getWpm());
		System.out.printf( "║  Raw WPM    : %-15d ║%n", result.getRawWpm());
		System.out.printf( "║  Accuracy   : %-13.1f%%  ║%n", result.getAccuracy());
		System.out.printf( "║  Errors     : %-15d ║%n", result.getErrors());
		System.out.printf( "║  Correct    : %-10d chars ║%n", result.getCorrectChars());
		System.out.printf( "║  Mode       : %-15s ║%n", result.getMode());
		System.out.printf( "║  Difficulty : %-15s ║%n", result.getDifficulty());
		System.out.printf( "║  Duration   : %-13ds   ║%n", result.getTimeTaken());
		System.out.println("╚══════════════════════════════╝\n");

		String grade    = calculateGrade(result.getWpm(), result.getAccuracy());
		String feedback = generateFeedback(grade, result.getWpm(), result.getAccuracy());

		return new TypingResultResponse("Result saved successfully", feedback, grade);
	}

	// ── Helpers ─────────────────────────────────────────────────

	/** Estimate words needed so the test doesn't run out of text */
	private int estimateWordCount(String mode, int duration, String diff) {
		if ("words".equals(mode)) return duration; // duration = wordLimit for words mode
		// Average WPM per difficulty: easy≈40, medium≈60, hard≈80; pad 20%
		int avgWpm = switch (diff) {
			case "easy" -> 40;
			case "hard" -> 80;
			default     -> 60;
		};
		return (int) Math.ceil((avgWpm * (duration / 60.0)) * 1.4);
	}

	private String calculateGrade(int wpm, double accuracy) {
		double score = wpm * (accuracy / 100.0);
		if (score >= 100) return "S";
		if (score >= 75)  return "A";
		if (score >= 50)  return "B";
		if (score >= 30)  return "C";
		if (score >= 12)  return "D";
		return "F";
	}

	private String generateFeedback(String grade, int wpm, double accuracy) {
		return switch (grade) {
			case "S" -> "Legendary! You are in the top 1% of typists worldwide!";
			case "A" -> "Excellent speed and precision — well above average!";
			case "B" -> "Great work! You are making real progress every session.";
			case "C" -> accuracy < 85
					? "Good speed — now sharpen your accuracy for a higher grade!"
					: "Good effort! Keep practising and your speed will climb.";
			case "D" -> accuracy < 80
					? "Focus on accuracy first — slow down and type each word correctly."
					: "You are building a solid foundation. Practise daily to improve!";
			default  -> "Every expert started exactly where you are. Keep going!";
		};
	}
}