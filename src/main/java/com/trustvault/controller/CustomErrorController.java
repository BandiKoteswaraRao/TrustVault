package com.trustvault.controller;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class CustomErrorController implements ErrorController {

    @RequestMapping("/access-denied")
    public String accessDenied(@RequestParam(required = false) String uri, Model model) {
        model.addAttribute("blockedUri", uri != null ? uri : "Protected Resource");
        return "error/403";
    }

    @RequestMapping("/error")
    public String handleError(HttpServletRequest request, Model model) {
        Object status = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        Object message = request.getAttribute(RequestDispatcher.ERROR_MESSAGE);
        Object uri = request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);

        int statusCode = 500;
        if (status != null) {
            try {
                statusCode = Integer.parseInt(status.toString());
            } catch (NumberFormatException ignored) {
            }
        }

        model.addAttribute("statusCode", statusCode);
        model.addAttribute("errorMessage", message != null && !message.toString().isBlank()
                ? message.toString() : "An unexpected server event occurred.");
        model.addAttribute("requestedUri", uri != null ? uri.toString() : "Unknown");

        if (statusCode == HttpStatus.NOT_FOUND.value()) {
            return "error/404";
        } else if (statusCode == HttpStatus.FORBIDDEN.value()) {
            model.addAttribute("blockedUri", uri != null ? uri.toString() : "Protected Resource");
            return "error/403";
        }

        return "error/500";
    }
}
