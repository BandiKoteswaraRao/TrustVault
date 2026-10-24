package com.trustvault.repository;

import com.trustvault.model.Document;
import com.trustvault.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {

    List<Document> findByOwnerOrderByCreatedAtDesc(User owner);

    @Query("SELECT DISTINCT d FROM Document d LEFT JOIN d.permissions p " +
           "WHERE (d.owner = :user OR p.user = :user) " +
           "ORDER BY d.createdAt DESC")
    List<Document> findAllAccessibleByUser(@Param("user") User user);

    @Query("SELECT DISTINCT d FROM Document d LEFT JOIN d.permissions p " +
           "WHERE (d.owner = :user OR p.user = :user) " +
           "AND (:category IS NULL OR :category = '' OR d.category = :category) " +
           "AND (:query IS NULL OR :query = '' OR LOWER(d.title) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(d.description) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY d.createdAt DESC")
    List<Document> searchAccessibleByUser(@Param("user") User user,
                                         @Param("category") String category,
                                         @Param("query") String query);

    @Query("SELECT d FROM Document d " +
           "WHERE (:category IS NULL OR :category = '' OR d.category = :category) " +
           "AND (:query IS NULL OR :query = '' OR LOWER(d.title) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(d.description) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY d.createdAt DESC")
    List<Document> searchAll(@Param("category") String category,
                             @Param("query") String query);

    List<Document> findByCategoryOrderByCreatedAtDesc(String category);

    Optional<Document> findByStoredFileName(String storedFileName);

    long countByOwner(User owner);
}
