

import 'dart:io';

import 'package:ente_auth/core/constants.dart';
import 'package:ente_auth/core/network.dart';
import 'package:ente_auth/services/notification_service.dart';
import 'package:flutter/foundation.dart';
import 'package:logging/logging.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

class UpdateService {
  UpdateService._privateConstructor();

  static final UpdateService instance = UpdateService._privateConstructor();
  static const kUpdateAvailableShownTimeKey = "update_available_shown_time_key";

  LatestVersionInfo? _latestVersion;
  final _logger = Logger("UpdateService");
  late PackageInfo _packageInfo;
  late SharedPreferences _prefs;

  Future<void> init() async {
    _packageInfo = await PackageInfo.fromPlatform();
    _prefs = await SharedPreferences.getInstance();
  }

  Future<bool> shouldUpdate() async {
    if (!isIndependent()) {
      return false;
    }
    try {
      _latestVersion = await _getLatestVersionInfo();
      final currentVersionCode = int.parse(_packageInfo.buildNumber);
      return currentVersionCode < _latestVersion!.code!;
    } catch (e) {
      _logger.severe(e);
      return false;
    }
  }

  bool shouldForceUpdate(LatestVersionInfo? info) {
    if (!isIndependent()) {
      return false;
    }
    try {
      final currentVersionCode = int.parse(_packageInfo.buildNumber);
      return currentVersionCode < info!.lastSupportedVersionCode;
    } catch (e) {
      _logger.severe(e);
      return false;
    }
  }

  LatestVersionInfo? getLatestVersionInfo() {
    return _latestVersion;
  }

  Future<void> showUpdateNotification() async {
    if (!isIndependent()) {
      return;
    }
    final shouldUpdate = await this.shouldUpdate();
    final lastNotificationShownTime =
        _prefs.getInt(kUpdateAvailableShownTimeKey) ?? 0;
    final now = DateTime.now().microsecondsSinceEpoch;
    final hasBeen3DaysSinceLastNotification =
        (now - lastNotificationShownTime) > (3 * microSecondsInDay);
    if (shouldUpdate &&
        hasBeen3DaysSinceLastNotification &&
        _latestVersion!.shouldNotify!) {
      NotificationService.instance.showNotification(
        "Update available",
        "Click to install our best version yet",
      );
      await _prefs.setInt(kUpdateAvailableShownTimeKey, now);
    } else {
      _logger.info("Debouncing notification");
    }
  }

  Future<LatestVersionInfo> _getLatestVersionInfo() async {
    final response = await Network.instance
        .getDio()
        .get("https://ente.io/release-info/auth-independent.json");
    return LatestVersionInfo.fromMap(response.data["latestVersion"]);
  }

  bool isIndependent() {
    if (Platform.isIOS) {
      return false;
    }
    return kDebugMode || _packageInfo.packageName.endsWith("independent");
  }
}

class LatestVersionInfo {
  final String? name;
  final int? code;
  final List<String> changelog;
  final bool? shouldForceUpdate;
  final int lastSupportedVersionCode;
  final String? url;
  final int? size;
  final bool? shouldNotify;

  LatestVersionInfo(
    this.name,
    this.code,
    this.changelog,
    this.shouldForceUpdate,
    this.lastSupportedVersionCode,
    this.url,
    this.size,
    this.shouldNotify,
  );

  factory LatestVersionInfo.fromMap(Map<String, dynamic> map) {
    return LatestVersionInfo(
      map['name'],
      map['code'],
      List<String>.from(map['changelog']),
      map['shouldForceUpdate'],
      map['lastSupportedVersionCode'] ?? 1,
      map['url'],
      map['size'],
      map['shouldNotify'],
    );
  }
}
