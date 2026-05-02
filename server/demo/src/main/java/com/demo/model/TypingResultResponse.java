package com.demo.model;

public class TypingResultResponse {

    private String message;
    private String feedback;
    private String grade;

    public TypingResultResponse() {}

    public TypingResultResponse(String message, String feedback, String grade) {
        this.message = message;
        this.feedback = feedback;
        this.grade = grade;
    }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }

    public String getGrade() { return grade; }
    public void setGrade(String grade) { this.grade = grade; }
}