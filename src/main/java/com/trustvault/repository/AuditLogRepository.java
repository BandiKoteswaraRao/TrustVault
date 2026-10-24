package com.trustvault.repository;

import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditLog;
import com.trustvault.model.AuditStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Optional<AuditLog> findTopByOrderByIdDesc();

    List<AuditLog> findAllByOrderByIdAsc();

    List<AuditLog> findTop10ByOrderByTimestampDesc();

    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE " +
           "(:action IS NULL OR a.action = :action) AND " +
           "(:status IS NULL OR a.status = :status) AND " +
           "(:query IS NULL OR :query = '' OR " +
           " LOWER(a.actorUsername) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(a.targetId) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(a.details) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY a.timestamp DESC")
    Page<AuditLog> searchAuditLogs(@Param("action") AuditAction action,
                                  @Param("status") AuditStatus status,
                                  @Param("query") String query,
                                  Pageable pageable);

    long countByStatus(AuditStatus status);

    long countByAction(AuditAction action);
}
