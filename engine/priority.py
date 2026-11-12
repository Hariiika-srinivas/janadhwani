"""
Dynamic Priority Scoring Engine for JanaDhwani
Generates a priority score from 0 to 100 based on:
- Category importance
- Cluster size (duplicate count)
- SLA proximity
- Vulnerable ward (Maternity, Pediatric, ICU)
- Sentiment urgency
"""

def calculate_priority(
    category_weight: int = 50,
    duplicate_count: int = 1,
    sla_progress: float = 0.0,
    is_vulnerable_ward: bool = False,
    sentiment: str = "NEGATIVE"
) -> int:
    """
    Computes priority score (0-100).
    """
    # 1. Base score from category weight (40% weight contribution)
    score = category_weight * 0.40

    # 2. Duplicate cluster contribution: +5 per additional report, max +30
    extra_reports = max(0, duplicate_count - 1)
    cluster_boost = min(30.0, extra_reports * 5.0)
    score += cluster_boost

    # 3. SLA proximity: as deadline nears or passes, add up to 20 points
    sla_boost = min(20.0, sla_progress * 15.0)
    if sla_progress >= 1.0: # Overdue
        sla_boost += 5.0
    score += sla_boost

    # 4. Vulnerable Ward bonus (+25 points for Maternity, Pediatric, ICU)
    if is_vulnerable_ward:
        score += 25.0

    # 5. Sentiment urgency (+10 points for URGENT)
    if sentiment == "URGENT":
        score += 10.0

    final_score = int(round(score))
    return max(5, min(100, final_score))
