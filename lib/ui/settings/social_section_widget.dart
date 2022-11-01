// @dart=2.9

import 'dart:io';

import 'package:ente_auth/services/update_service.dart';
import 'package:ente_auth/theme/ente_theme.dart';
import 'package:ente_auth/ui/components/captioned_text_widget.dart';
import 'package:ente_auth/ui/components/expandable_menu_item_widget.dart';
import 'package:ente_auth/ui/components/menu_item_widget.dart';
import 'package:ente_auth/ui/settings/common_settings.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher_string.dart';

class SocialSectionWidget extends StatelessWidget {
  const SocialSectionWidget({Key key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ExpandableMenuItemWidget(
      title: "Social",
      selectionOptionsWidget: _getSectionOptions(context),
      leadingIcon: Icons.interests_outlined,
    );
  }

  Widget _getSectionOptions(BuildContext context) {
    final List<Widget> options = [
      sectionOptionSpacing,
      const SocialsMenuItemWidget("Twitter", "https://twitter.com/enteio"),
      sectionOptionSpacing,
      const SocialsMenuItemWidget("Discord", "https://ente.io/discord"),
      sectionOptionSpacing,
      const SocialsMenuItemWidget("Reddit", "https://reddit.com/r/enteio"),
      sectionOptionSpacing,
    ];
    if (!UpdateService.instance.isIndependent()) {
      options.addAll(
        [
          SocialsMenuItemWidget(
            "Rate us! ✨",
            Platform.isAndroid
                ? "https://play.google.com/store/apps/details?id=io.ente.photos"
                : "https://apps.apple.com/in/app/ente-photos/id1542026904",
          ),
          sectionOptionSpacing,
        ],
      );
    }
    return Column(children: options);
  }
}

class SocialsMenuItemWidget extends StatelessWidget {
  final String text;
  final String urlSring;
  const SocialsMenuItemWidget(this.text, this.urlSring, {Key key})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MenuItemWidget(
      captionedTextWidget: CaptionedTextWidget(
        title: text,
      ),
      pressedColor: getEnteColorScheme(context).fillFaint,
      trailingIcon: Icons.chevron_right_outlined,
      trailingIconIsMuted: true,
      onTap: () {
        launchUrlString(urlSring);
      },
    );
  }
}
