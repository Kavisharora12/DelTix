package models

import (
	"errors"
	"strings"

	sharedmodels "github.com/deltix/shared/models"
)

var (
	ErrEmptyPrompt = errors.New("natural_language_prompt must not be empty")
)

type CompileOutcomeStatus string

const (
	OutcomeClarificationRequired CompileOutcomeStatus = "CLARIFICATION_REQUIRED"
	OutcomeFailedValidation      CompileOutcomeStatus = "FAILED_VALIDATION"
	OutcomeReady                 CompileOutcomeStatus = "READY"
)

type CompileRequest struct {
	Name                  string            `json:"name"`
	Category              string            `json:"category"`
	NaturalLanguagePrompt string            `json:"natural_language_prompt"`
	Clarifications        map[string]string `json:"clarifications,omitempty"`
}

func (r CompileRequest) Validate() error {
	if strings.TrimSpace(r.NaturalLanguagePrompt) == "" {
		return ErrEmptyPrompt
	}
	return nil
}

type ClarificationQuestion struct {
	Field       string   `json:"field"`
	Question    string   `json:"question"`
	WhyRequired string   `json:"why_required"`
	Suggestions []string `json:"suggestions,omitempty"`
}

type SyntheticTestResult struct {
	ScenarioName string `json:"scenario_name"`
	Passed       bool   `json:"passed"`
	StepsVisited int    `json:"steps_visited"`
	Detail       string `json:"detail"`
}

type CompileResponse struct {
	Status                 CompileOutcomeStatus          `json:"status"`
	SpecID                 string                        `json:"spec_id,omitempty"`
	AgentID                string                        `json:"agent_id,omitempty"`
	Version                string                        `json:"version,omitempty"`
	ClarificationQuestions []ClarificationQuestion       `json:"clarification_questions,omitempty"`
	AgentIR                *sharedmodels.AgentIR         `json:"agent_ir,omitempty"`
	ValidationReport       sharedmodels.ValidationReport `json:"validation_report"`
	SyntheticTests         []SyntheticTestResult         `json:"synthetic_tests,omitempty"`
	ReadinessToken         string                        `json:"readiness_token,omitempty"`
	TraceID                string                        `json:"trace_id"`
}

type SpecListResponse struct {
	Specs      []sharedmodels.AgentSpec `json:"specs"`
	NextCursor int64                    `json:"next_cursor,omitempty"`
	TraceID    string                   `json:"trace_id"`
}
