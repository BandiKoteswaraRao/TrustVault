package com.trustvault.repository;

import com.trustvault.model.Document;
import com.trustvault.model.DocumentPermission;
import com.trustvault.model.PermissionType;
import com.trustvault.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentPermissionRepository extends JpaRepository<DocumentPermission, Long> {

    Optional<DocumentPermission> findByDocumentAndUser(Document document, User user);

    List<DocumentPermission> findByDocumentOrderByGrantedAtDesc(Document document);

    List<DocumentPermission> findByUserOrderByGrantedAtDesc(User user);

    boolean existsByDocumentAndUser(Document document, User user);

    boolean existsByDocumentAndUserAndPermissionType(Document document, User user, PermissionType permissionType);

    void deleteByDocumentAndUser(Document document, User user);

    void deleteByDocument(Document document);
}
