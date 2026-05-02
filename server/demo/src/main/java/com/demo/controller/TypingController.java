package com.demo.controller;

import com.demo.model.TypingResult;
import com.demo.model.TypingResultResponse;
import com.demo.model.TypingTextResponse;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api")
public class TypingController {

	// --------------------------------------------------------
	// TEXT POOLS — 3 difficulty levels, 8 passages each
	// --------------------------------------------------------
	private static final Map<String, List<String>> TEXT_POOL = new LinkedHashMap<>();

	static {
		TEXT_POOL.put("easy", Arrays.asList(
				"the cat sat on the mat and looked at the bird on the wall next to the old red door of the small house by the tree",
				"she sells sea shells by the sea shore and the shells she sells are sea shells she is quite sure about that fact",
				"i like to eat cake and pie and ice cream and cookies on warm sunny days in the park with all my good friends",
				"the sun was bright and the sky was blue and the children played in the yard all day long having a lot of fun",
				"good food and clean water are two of the most important things you need to live a happy and healthy life every day",
				"the big brown dog ran fast across the green field and jumped high over the small wooden fence near the old red barn",
				"every morning she woke up early to watch the sunrise from her window with a hot cup of tea in her warm hand",
				"he opened the door and walked into the room where his friends were waiting for him with big smiles on their faces"
		));

		TEXT_POOL.put("medium", Arrays.asList(
				"The quick brown fox jumps over the lazy dog near the riverbank while birds sing softly in the tall oak trees above it",
				"Programming is the art of solving problems through logical thinking and turning abstract ideas into real working software applications",
				"Success is not about being the best but about always doing better than you did the day before in every area of life",
				"The greatest adventure you can take is to live the life of your dreams while helping others achieve theirs along the way",
				"Technology shapes the world we live in and those who understand it have the power to change the future for everyone around them",
				"Reading books expands your mind and fills you with knowledge and wisdom that no other activity can quite replicate in daily life",
				"Consistency and dedication over a long period of time will always outperform short bursts of motivation that fade away too quickly",
				"The human brain is capable of extraordinary things when given the right environment and the proper encouragement to grow and to learn"
		));

		TEXT_POOL.put("hard", Arrays.asList(
				"Perseverance through adversity cultivates extraordinary character while resilience transforms unprecedented challenges into remarkable opportunities for meaningful personal growth.",
				"Sophisticated algorithms efficiently process multidimensional datasets extracting statistically significant correlations between seemingly unrelated variables across distributed computing architectures.",
				"Quantum mechanics fundamentally challenges classical physics paradigms demonstrating that subatomic particles simultaneously inhabit multiple probabilistic states until directly observed.",
				"Biochemical pathways orchestrate extraordinarily complex metabolic processes synthesizing essential macromolecules through enzymatic catalysis under precisely regulated physiological conditions.",
				"Contemporary philosophical discourse examines existential phenomenology interrogating consciousness temporality and intersubjective experience through rigorous hermeneutical methodologies and critical analysis.",
				"The intricate interplay between neurological processes cognitive frameworks and environmental stimuli ultimately determines the complexity of all human behavioral responses.",
				"Geopolitical transformations throughout history demonstrate cyclical patterns of institutional evolution revolutionary upheaval and subsequent stabilization across all civilizational boundaries.",
				"Cryptographic protocols employ sophisticated mathematical constructs including asymmetric encryption elliptic curve algorithms and zero knowledge proofs to ensure complete data integrity."
		));
	}

	// --------------------------------------------------------
	// GET /api/text — fetch a random passage
	// --------------------------------------------------------
	@GetMapping("/text")
	public TypingTextResponse getTypingText(
			@RequestParam(defaultValue = "medium") String difficulty,
			@RequestParam(defaultValue = "time")   String mode,
			@RequestParam(defaultValue = "60")     int    duration) {

		String diff = difficulty.toLowerCase().trim();
		if (!TEXT_POOL.containsKey(diff)) {
			throw new IllegalArgumentException(
					"Unknown difficulty: '" + difficulty + "'. Valid values: easy, medium, hard");
		}

		List<String> pool = TEXT_POOL.get(diff);
		Random rand = new Random();
		String text = pool.get(rand.nextInt(pool.size()));

		// For longer time modes, append a second unique passage so the test never runs out of text
		if ("time".equals(mode) && duration >= 60) {
			String extra = pool.get(rand.nextInt(pool.size()));
			if (!extra.equals(text)) {
				text = text + " " + extra;
			}
		}

		return new TypingTextResponse(text, diff, mode);
	}

	// --------------------------------------------------------
	// GET /api/info — meta: available options
	// --------------------------------------------------------
	@GetMapping("/info")
	public Map<String, Object> getAppInfo() {
		Map<String, Object> info = new LinkedHashMap<>();
		info.put("difficulties", Arrays.asList("easy", "medium", "hard"));
		info.put("modes",        Arrays.asList("time", "words"));
		info.put("timeOptions",  Arrays.asList(15, 30, 60, 120));
		info.put("wordOptions",  Arrays.asList(10, 25, 50, 100));
		info.put("version", "2.0.0");
		return info;
	}

	// --------------------------------------------------------
	// POST /api/result — receive and evaluate a completed test
	// --------------------------------------------------------
	@PostMapping("/result")
	public TypingResultResponse saveResult(@RequestBody TypingResult result) {

		// Validate incoming data
		if (result.getWpm() < 0 || result.getAccuracy() < 0 || result.getAccuracy() > 100) {
			throw new IllegalArgumentException("Result contains invalid statistics.");
		}

		// Console summary
		System.out.println("\n╔══════════════════════════════╗");
		System.out.println("║       TYPING TEST RESULT     ║");
		System.out.println("╠══════════════════════════════╣");
		System.out.printf( "║  WPM        : %-15d ║%n", result.getWpm());
		System.out.printf( "║  Raw WPM    : %-15d ║%n", result.getRawWpm());
		System.out.printf( "║  Accuracy   : %-14.1f%% ║%n", result.getAccuracy());
		System.out.printf( "║  Errors     : %-15d ║%n", result.getErrors());
		System.out.printf( "║  Correct    : %-10d chars ║%n", result.getCorrectChars());
		System.out.printf( "║  Mode       : %-15s ║%n", result.getMode());
		System.out.printf( "║  Difficulty : %-15s ║%n", result.getDifficulty());
		System.out.printf( "║  Duration   : %-13ds   ║%n", result.getTimeTaken());
		System.out.println("╚══════════════════════════════╝\n");

		String grade    = calculateGrade(result.getWpm(), result.getAccuracy());
		String feedback = generateFeedback(result.getWpm(), result.getAccuracy(), grade);

		return new TypingResultResponse("Result saved successfully", feedback, grade);
	}

	// --------------------------------------------------------
	// Internal helpers
	// --------------------------------------------------------
	private String calculateGrade(int wpm, double accuracy) {
		// Grade is based on a combined score: WPM weighted with accuracy
		double score = wpm * (accuracy / 100.0);
		if (score >= 110) return "S";
		if (score >= 85)  return "A";
		if (score >= 60)  return "B";
		if (score >= 35)  return "C";
		if (score >= 15)  return "D";
		return "F";
	}

	private String generateFeedback(int wpm, double accuracy, String grade) {
		switch (grade) {
			case "S": return "Legendary! You belong in the hall of fame!";
			case "A": return "Excellent! You are well above average!";
			case "B": return "Great work! Keep pushing your limits!";
			case "C": return "Good job! Practice makes perfect!";
			case "D":
				if (accuracy < 80) return "Focus on accuracy first — speed will follow!";
				return "Keep practicing daily — you are improving!";
			default:
				return "Every expert was once a beginner. Keep going!";
		}
	}
}