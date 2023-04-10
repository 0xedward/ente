

import 'dart:async';
import 'dart:io';
import 'dart:ui';

import 'package:ente_auth/core/configuration.dart';
import 'package:ente_auth/ente_theme_data.dart';
import 'package:ente_auth/l10n/l10n.dart';
import 'package:ente_auth/models/code.dart';
import 'package:ente_auth/services/authenticator_service.dart';
import 'package:ente_auth/services/local_authentication_service.dart';
import 'package:ente_auth/store/code_store.dart';
import 'package:ente_auth/theme/ente_theme.dart';
import 'package:ente_auth/ui/components/captioned_text_widget.dart';
import 'package:ente_auth/ui/components/dialog_widget.dart';
import 'package:ente_auth/ui/components/expandable_menu_item_widget.dart';
import 'package:ente_auth/ui/components/menu_item_widget.dart';
import 'package:ente_auth/ui/components/models/button_type.dart';
import 'package:ente_auth/ui/settings/common_settings.dart';
import 'package:ente_auth/utils/dialog_util.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:logging/logging.dart';
import 'package:share_plus/share_plus.dart';

class DataSectionWidget extends StatelessWidget {
  final _logger = Logger("AccountSectionWidget");

  final _codeFile = File(
    Configuration.instance.getTempDirectory() + "ente-authenticator-codes.txt",
  );

  DataSectionWidget({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return ExpandableMenuItemWidget(
      title: l10n.data,
      selectionOptionsWidget: _getSectionOptions(context),
      leadingIcon: Icons.key_outlined,
    );
  }

  Column _getSectionOptions(BuildContext context) {
    final l10n = context.l10n;
    List<Widget> children = [];
    children.addAll([
      sectionOptionSpacing,
      MenuItemWidget(
        captionedTextWidget: CaptionedTextWidget(
          title: l10n.importCodes,
        ),
        pressedColor: getEnteColorScheme(context).fillFaint,
        trailingIcon: Icons.chevron_right_outlined,
        trailingIconIsMuted: true,
        onTap: () async {
          _showImportInstructionDialog(context);
        },
      ),
      sectionOptionSpacing,
      MenuItemWidget(
        captionedTextWidget: CaptionedTextWidget(
          title: l10n.exportCodes,
        ),
        pressedColor: getEnteColorScheme(context).fillFaint,
        trailingIcon: Icons.chevron_right_outlined,
        trailingIconIsMuted: true,
        onTap: () async {
          _showExportWarningDialog(context);
        },
      ),
      sectionOptionSpacing,
    ]);
    return Column(
      children: children,
    );
  }

  Future<void> _showImportInstructionDialog(BuildContext context) async {
    final l10n = context.l10n;
    final AlertDialog alert = AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      title: Text(
        l10n.importCodes,
        style: Theme.of(context).textTheme.headline6,
      ),
      content: SingleChildScrollView(
        child: Column(
          children: [
            Text(
              l10n.importInstruction,
            ),
            const SizedBox(
              height: 20,
            ),
            Container(
              color: Theme.of(context).colorScheme.gNavBackgroundColor,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Text(
                  "otpauth://totp/provider.com:you@email.com?secret=YOUR_SECRET",
                  style: TextStyle(
                    fontFeatures: const [FontFeature.tabularFigures()],
                    fontFamily: Platform.isIOS ? "Courier" : "monospace",
                    fontSize: 13,
                  ),
                ),
              ),
            ),
            const SizedBox(
              height: 20,
            ),
            Text(l10n.importCodeDelimiterInfo),
          ],
        ),
      ),
      actions: [
        TextButton(
          child: Text(
            l10n.cancel,
            style: const TextStyle(
              color: Colors.red,
            ),
          ),
          onPressed: () {
            Navigator.of(context, rootNavigator: true).pop('dialog');
          },
        ),
        TextButton(
          child: Text(l10n.selectFile),
          onPressed: () {
            Navigator.of(context, rootNavigator: true).pop('dialog');
            _pickImportFile(context);
          },
        ),
      ],
    );

    return showDialog(
      context: context,
      builder: (BuildContext context) {
        return alert;
      },
      barrierColor: Colors.black12,
    );
  }

  Future<void> _showExportWarningDialog(BuildContext context) async {
    final AlertDialog alert = AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      title: Text(
        "Warning",
        style: Theme.of(context).textTheme.headline6,
      ),
      content: const Text(
        "The exported file contains sensitive information. Please store this safely.",
      ),
      actions: [
        TextButton(
          child: const Text(
            "I understand",
            style: TextStyle(
              color: Colors.red,
            ),
          ),
          onPressed: () {
            Navigator.of(context, rootNavigator: true).pop('dialog');
            _exportCodes(context);
          },
        ),
        TextButton(
          child: const Text(
            "Cancel",
          ),
          onPressed: () {
            Navigator.of(context, rootNavigator: true).pop('dialog');
          },
        ),
      ],
    );

    return showDialog(
      context: context,
      builder: (BuildContext context) {
        return alert;
      },
      barrierColor: Colors.black12,
    );
  }

  Future<void> _exportCodes(BuildContext context) async {
    final hasAuthenticated =
        await LocalAuthenticationService.instance.requestLocalAuthentication(
      context,
      "Please authenticate to export your codes",
    );
    if (!hasAuthenticated) {
      return;
    }
    if (_codeFile.existsSync()) {
      await _codeFile.delete();
    }
    final codes = await CodeStore.instance.getAllCodes();
    String data = "";
    for (final code in codes) {
      data += code.rawData + "\n";
    }
    _codeFile.writeAsStringSync(data);
    await Share.shareFiles([_codeFile.path]);
    Future.delayed(const Duration(seconds: 15), () async {
      if (_codeFile.existsSync()) {
        _codeFile.deleteSync();
      }
    });
  }

  Future<void> _pickImportFile(BuildContext context) async {
    final l10n = context.l10n;
    FilePickerResult? result = await FilePicker.platform.pickFiles();
    if (result == null) {
      return;
    }
    final dialog = createProgressDialog(context, l10n.pleaseWait);
    await dialog.show();
    try {
      File file = File(result.files.single.path!);
      final codes = await file.readAsString();
      List<String> splitCodes = codes.split(",");
      if (splitCodes.length == 1) {
        splitCodes = codes.split("\n");
      }
      final parsedCodes = [];
      for (final code in splitCodes) {
        try {
          parsedCodes.add(Code.fromRawData(code));
        } catch (e) {
          _logger.severe("Could not parse code", e);
        }
      }
      for (final code in parsedCodes) {
        await CodeStore.instance.addCode(code, shouldSync: false);
      }
      unawaited(AuthenticatorService.instance.sync());

      final DialogWidget dialog = choiceDialog(
        title: "Yay!",
        body: "You have imported " + parsedCodes.length.toString() + " codes!",
        firstButtonLabel: l10n.ok,
        firstButtonOnTap: () async {
          Navigator.of(context, rootNavigator: true).pop('dialog');
        },
        firstButtonType: ButtonType.primary,
      );
      await showConfettiDialog(
        context: context,
        dialogBuilder: (BuildContext context) {
          return dialog;
        },
      );
    } catch (e) {
      await dialog.hide();
      await showErrorDialog(
        context,
        "Sorry",
        "Could not parse the selected file.\nPlease write to support@ente.io if you need help!",
      );
    }
  }
}
