package com.demo.model;

public class TypingTextResponse {

    private String text;
    private String difficulty;
    private String mode;
    private int wordCount;

    public TypingTextResponse() {}

    public TypingTextResponse(String text, String difficulty, String mode) {
        this.text = text;
        this.difficulty = difficulty;
        this.mode = mode;
        this.wordCount = text.trim().isEmpty() ? 0 : text.trim().split("\\s+").length;
    }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public int getWordCount() { return wordCount; }
    public void setWordCount(int wordCount) { this.wordCount = wordCount; }
}