package com.demo.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.*;

/**
 * Calls the OpenAI Chat Completions API to generate typing-test passages.
 * If the API key is not configured or the call fails, returns null
 * so the controller can fall back to the built-in text pools.
 */
@Service
public class OpenAIService {

    @Value("${openai.api.key:}")
    private String apiKey;

    @Value("${openai.model:gpt-3.5-turbo}")
    private String model;

    @Value("${openai.enabled:false}")
    private boolean enabled;

    @Value("${openai.max-tokens:280}")
    private int maxTokens;

    private static final String OPENAI_URL =
            "https://api.openai.com/v1/chat/completions";

    private final RestTemplate restTemplate;

    public OpenAIService() {
        // 10s connect, 25s read — generous for GPT-3.5
        org.springframework.boot.web.client.RestTemplateBuilder builder =
                new org.springframework.boot.web.client.RestTemplateBuilder();
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(25))
                .build();
    }

    // ── Public API ──────────────────────────────────────────────

    public boolean isAvailable() {
        return enabled
                && apiKey != null
                && !apiKey.isBlank()
                && !apiKey.equalsIgnoreCase("your-api-key-here");
    }

    /**
     * Generate a typing-test passage.
     *
     * @param difficulty  easy | medium | hard
     * @param topic       random | technology | nature | science | history | sports | business | motivation | health
     * @param targetWords approximate number of words wanted
     * @return the generated passage, or null if unavailable / failed
     */
    public String generateText(String difficulty, String topic, int targetWords) {
        if (!isAvailable()) return null;

        String prompt  = buildPrompt(difficulty, topic, targetWords);
        Map<String, Object> body = buildRequestBody(prompt);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response =
                    restTemplate.postForEntity(OPENAI_URL, request, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                String text = extractContent(response.getBody());
                if (text != null && !text.isBlank()) {
                    return sanitise(text);
                }
            }
        } catch (Exception e) {
            System.err.println("[OpenAI] API call failed: " + e.getMessage());
        }
        return null;   // caller falls back to text pool
    }

    // ── Private helpers ─────────────────────────────────────────

    private String buildPrompt(String difficulty, String topic, int targetWords) {

        String topicLine = "random".equalsIgnoreCase(topic)
                ? "on any interesting general subject"
                : "about " + topic;

        String style = switch (difficulty.toLowerCase()) {
            case "easy"  -> "Use very short, simple sentences with only common everyday words. " +
                            "Avoid any punctuation except periods and commas. Suitable for beginners.";
            case "hard"  -> "Use complex sentences with sophisticated vocabulary, technical terminology, " +
                            "and varied punctuation (commas and periods only). " +
                            "Suitable for advanced typists.";
            default      -> "Use moderate vocabulary with a natural mix of short and medium-length sentences. " +
                            "Suitable for intermediate typists.";
        };

        return String.format(
                "Write a typing-test passage %s for a '%s' difficulty level. " +
                "Target approximately %d words. " +
                "%s " +
                "Rules: NO special characters, NO numbers, NO parentheses, NO dashes, NO quotes, " +
                "NO colons or semicolons, NO bullet points, NO title or heading. " +
                "Return ONLY a single plain paragraph of continuous prose and nothing else.",
                topicLine, difficulty, targetWords, style
        );
    }

    private Map<String, Object> buildRequestBody(String prompt) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("role",    "user");
        message.put("content", prompt);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model",       model);
        body.put("max_tokens",  maxTokens);
        body.put("temperature", 0.82);   // slight variety each time
        body.put("messages",    Collections.singletonList(message));
        return body;
    }

    @SuppressWarnings("unchecked")
    private String extractContent(Map<?, ?> responseBody) {
        try {
            List<?> choices = (List<?>) responseBody.get("choices");
            if (choices == null || choices.isEmpty()) return null;
            Map<?, ?> choice = (Map<?, ?>) choices.get(0);
            Map<?, ?> msg    = (Map<?, ?>) choice.get("message");
            return msg != null ? (String) msg.get("content") : null;
        } catch (ClassCastException e) {
            return null;
        }
    }

    /**
     * Strip anything that would break the typing test:
     * leading/trailing whitespace, multiple spaces, newlines.
     */
    private String sanitise(String raw) {
        return raw.trim()
                  .replaceAll("\\r?\\n+", " ")   // newlines → space
                  .replaceAll("\\s{2,}", " ")     // multiple spaces → one
                  .replaceAll("[\"'""'']", "")    // curly/straight quotes
                  .replaceAll("[\\-–—]", " ")     // dashes → space
                  .replaceAll("[^a-zA-Z0-9 .,!?]", "") // remove remaining oddities
                  .replaceAll("\\s{2,}", " ")     // clean up again
                  .trim();
    }
}