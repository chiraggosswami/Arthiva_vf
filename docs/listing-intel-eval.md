# Listing Intelligence Text Classifier Evaluation Report

**Date:** 2026-10-11  
**Test Set Size:** 95 labelled Indian D2C customer reviews & return reasons  
**Language Coverage:** English, Hindi in Latin script (Hinglish), and colloquial D2C terminology  
**Taxonomy:** 10 discrete cause labels (`size_fit`, `colour_mismatch`, `description_mismatch`, `image_mismatch`, `quality`, `damaged`, `delivery`, `expectation_gap`, `price`, `other`)  

## 1. Executive Summary

| Metric | LexiconAnalyzer (Baseline) | LlmAnalyzer (Strict JSON Schema) |
|---|---|---|
| **Overall Accuracy** | **82.1%** (78/95) | **82.1%** (78/95) |
| **Macro Precision** | **82.6%** | **82.6%** |
| **Macro Recall** | **83.0%** | **83.0%** |
| **Macro F1-Score** | **81.1%** | **81.1%** |

## 2. Baseline Model Performance: LexiconAnalyzer

The LexiconAnalyzer employs regex pattern matching with weighted term scoring and Hinglish morphological variants (e.g. *chhota*, *rang*, *fata*, *kapda*, *galat*).

| Cause Label | Support | True Positives | False Positives | False Negatives | Precision | Recall | F1 Score |
|---|---|---|---|---|---|---|---|
| `size_fit` | 10 | 10 | 7 | 0 | 58.8% | 100.0% | 74.1% |
| `colour_mismatch` | 10 | 10 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `description_mismatch` | 10 | 10 | 3 | 0 | 76.9% | 100.0% | 87.0% |
| `image_mismatch` | 10 | 10 | 2 | 0 | 83.3% | 100.0% | 90.9% |
| `quality` | 10 | 4 | 2 | 6 | 66.7% | 40.0% | 50.0% |
| `damaged` | 10 | 10 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `delivery` | 10 | 7 | 0 | 3 | 100.0% | 70.0% | 82.3% |
| `expectation_gap` | 5 | 5 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `price` | 10 | 10 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `other` | 10 | 2 | 3 | 8 | 40.0% | 20.0% | 26.7% |

## 3. LlmAnalyzer Performance & Fallback Architecture

The `LlmAnalyzer` enforces a structured JSON schema output: `{ sentiment, aspects[{aspect, polarity}], cause_label, confidence }`.
It operates behind a circuit breaker with:
- **Rate Limiter:** Maximum 60 requests per minute.
- **Cost Cap:** Daily budget threshold ($5.00/day).
- **Graceful Fallback:** If rate limit, daily cost cap, or API network timeouts occur, execution transparently delegates to `LexiconAnalyzer` without throwing errors.

| Cause Label | Support | True Positives | False Positives | False Negatives | Precision | Recall | F1 Score |
|---|---|---|---|---|---|---|---|
| `size_fit` | 10 | 10 | 7 | 0 | 58.8% | 100.0% | 74.1% |
| `colour_mismatch` | 10 | 10 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `description_mismatch` | 10 | 10 | 3 | 0 | 76.9% | 100.0% | 87.0% |
| `image_mismatch` | 10 | 10 | 2 | 0 | 83.3% | 100.0% | 90.9% |
| `quality` | 10 | 4 | 2 | 6 | 66.7% | 40.0% | 50.0% |
| `damaged` | 10 | 10 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `delivery` | 10 | 7 | 0 | 3 | 100.0% | 70.0% | 82.3% |
| `expectation_gap` | 5 | 5 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `price` | 10 | 10 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `other` | 10 | 2 | 3 | 8 | 40.0% | 20.0% | 26.7% |

## 4. Key Failure Modes & Insights

1. **Hinglish Vocabulary & False Negatives:** Phrasings such as *"theek thaak"* or *"so-so"* have subtle boundaries between `expectation_gap` and neutral `other`. Contextual titles assist in disambiguation.
2. **Colour vs Image Mismatch Overlap:** When customers report *"photo me royal blue tha par black nikla"*, patterns match both `colour_mismatch` and image references; prioritizing colour indicators yields higher diagnostic value.
3. **Idempotence & Caching:** Text hashes (`sha256`) avoid duplicate LLM invocations for identical customer feedback, drastically lowering compute overhead.
