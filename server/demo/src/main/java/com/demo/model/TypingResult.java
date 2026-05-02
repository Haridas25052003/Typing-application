package com.demo.model;

public class TypingResult {

	private int wpm;
	private int rawWpm;
	private double accuracy;
	private int errors;
	private int correctChars;
	private int totalChars;
	private long timeTaken;   // seconds
	private String difficulty;
	private String mode;

	public TypingResult() {}

	public int getWpm() { return wpm; }
	public void setWpm(int wpm) { this.wpm = wpm; }

	public int getRawWpm() { return rawWpm; }
	public void setRawWpm(int rawWpm) { this.rawWpm = rawWpm; }

	public double getAccuracy() { return accuracy; }
	public void setAccuracy(double accuracy) { this.accuracy = accuracy; }

	public int getErrors() { return errors; }
	public void setErrors(int errors) { this.errors = errors; }

	public int getCorrectChars() { return correctChars; }
	public void setCorrectChars(int correctChars) { this.correctChars = correctChars; }

	public int getTotalChars() { return totalChars; }
	public void setTotalChars(int totalChars) { this.totalChars = totalChars; }

	public long getTimeTaken() { return timeTaken; }
	public void setTimeTaken(long timeTaken) { this.timeTaken = timeTaken; }

	public String getDifficulty() { return difficulty; }
	public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

	public String getMode() { return mode; }
	public void setMode(String mode) { this.mode = mode; }

	@Override
	public String toString() {
		return String.format("TypingResult{wpm=%d, rawWpm=%d, accuracy=%.1f, errors=%d, correct=%d, total=%d, time=%ds, mode='%s', diff='%s'}",
				wpm, rawWpm, accuracy, errors, correctChars, totalChars, timeTaken, mode, difficulty);
	}
}