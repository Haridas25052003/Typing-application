package com.demo.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // --- Bad request: invalid param type (e.g. "abc" where int expected) ---
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex) {
        return buildError(HttpStatus.BAD_REQUEST,
                "Invalid parameter type",
                "Parameter '" + ex.getName() + "' has invalid value: " + ex.getValue());
    }

    // --- Bad request: missing required param ---
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParam(
            MissingServletRequestParameterException ex) {
        return buildError(HttpStatus.BAD_REQUEST,
                "Missing parameter",
                "Required parameter '" + ex.getParameterName() + "' is missing");
    }

    // --- Bad request: malformed JSON body ---
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadableMessage(
            HttpMessageNotReadableException ex) {
        return buildError(HttpStatus.BAD_REQUEST,
                "Malformed request body",
                "Request body could not be parsed. Please send valid JSON.");
    }

    // --- Business logic error ---
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(
            IllegalArgumentException ex, WebRequest request) {
        return buildError(HttpStatus.BAD_REQUEST, "Invalid argument", ex.getMessage());
    }

    // --- Null pointer ---
    @ExceptionHandler(NullPointerException.class)
    public ResponseEntity<Map<String, Object>> handleNullPointer(NullPointerException ex) {
        return buildError(HttpStatus.INTERNAL_SERVER_ERROR,
                "Internal null reference",
                "A required value was null. Please contact support.");
    }

    // --- Catch-all ---
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleAll(Exception ex, WebRequest request) {
        System.err.println("[ERROR] Unhandled exception: " + ex.getMessage());
        ex.printStackTrace();
        return buildError(HttpStatus.INTERNAL_SERVER_ERROR,
                "Internal server error",
                "An unexpected error occurred. Please try again.");
    }

    // --- Helper ---
    private ResponseEntity<Map<String, Object>> buildError(
            HttpStatus status, String error, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", error);
        body.put("message", message);
        return new ResponseEntity<>(body, status);
    }
}